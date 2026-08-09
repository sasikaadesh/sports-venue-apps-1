import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { MessageActions } from "@/components/admin/message-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Messages — Admin" };

/**
 * The Contact Us inbox.
 *
 * Admin-level, not super-admin-level — answering enquiries is ordinary staff
 * work. `requireAdmin()` runs here as well as in the layout: the layout guard
 * is not a boundary on its own.
 */
export default async function AdminMessagesPage() {
  await requireAdmin("/admin/messages");

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      message: true,
      createdAt: true,
      readAt: true,
    },
  });

  const unread = messages.filter((m) => !m.readAt).length;

  return (
    <>
      <PageHeader
        title="Messages"
        description={
          messages.length === 0
            ? "Submissions from the public Contact us page land here."
            : `${messages.length} message${messages.length === 1 ? "" : "s"}, ${unread} unread — each is emailed to the office too.`
        }
      />

      {messages.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="No messages yet"
          description="When someone fills in the Contact us form, their message appears here with their name and email so you can reply directly."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const isRead = !!m.readAt;

            return (
              <li
                key={m.id}
                className={
                  isRead
                    ? "flex flex-col gap-3 rounded-xl border bg-card px-5 py-4"
                    : "flex flex-col gap-3 rounded-xl border border-primary/40 bg-card px-5 py-4"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-medium">{m.name}</span>
                      {!isRead && <Badge>New</Badge>}
                    </div>
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Courtside")}`}
                      className="w-fit truncate text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {m.email}
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </span>
                    <MessageActions id={m.id} isRead={isRead} from={m.name} />
                  </div>
                </div>

                {/* whitespace-pre-line so the paragraph breaks the sender typed
                    survive; the text itself is escaped by React. */}
                <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">
                  {m.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
