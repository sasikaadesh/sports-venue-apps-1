import { Lock, ShieldAlert, Users as UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { PaginationBar, SortableHeader } from "@/components/admin/table-tools";
import { UserConductDialog } from "@/components/admin/user-conduct-dialog";
import { UserFilterBar } from "@/components/admin/user-filter-bar";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { LinkButton } from "@/components/link-button";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, formatDateTime } from "@/lib/time";
import { countFlaggedUsers } from "@/lib/user-ratings";
import {
  hasActiveUserFilters,
  listAdminUsers,
  type UserFilters,
} from "@/lib/admin-users";
import {
  ADMIN_PAGE_SIZE,
  USER_SORT_DEFAULT_DIRECTION,
  buildAdminHref,
  flipDirection,
  parseAffiliationFilter,
  parsePage,
  parseRoleFilter,
  parseSearchParam,
  parseSortDirection,
  parseUserSort,
  type UserSort,
} from "@/lib/admin-filters";
import {
  AFFILIATION_LABEL,
  FLAGGED_RATING_MAX,
  parseUserRatingFilter,
  type AffiliationValue,
} from "@/lib/validations";

export const metadata = { title: "Users — Admin" };

const PATH = "/admin/users";

const ROLE_LABEL = {
  user: "user",
  admin: "admin",
  super_admin: "super admin",
} as const;

type UserSearchParams = {
  denied?: string;
  q?: string;
  role?: string;
  aff?: string;
  rated?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

/**
 * Registered accounts.
 *
 * Visible to any admin — knowing who has an account is ordinary staff need.
 * *Acting* on an admin account is super-admin only, decided per row below and
 * re-checked from the database inside every action.
 *
 * Filtering, sorting and paging follow the same pattern as the Bookings tab:
 * the query string is the whole view state, parsed into a fixed vocabulary by
 * `lib/admin-filters.ts`, and the work happens in Postgres wherever Postgres
 * can do it — see `lib/admin-users.ts` for the one thing it cannot, conduct.
 *
 * Two things on this page never leave it:
 *
 *   - **NIC** is sensitive personal data. It is shown here and on the owner's
 *     own account page, and nowhere else — no public page, no API response, no
 *     other user's view. It is not searchable from the filter bar either: the
 *     search box matches name and email only, so an NIC never travels in a URL.
 *   - **Conduct ratings** are private staff notes. The rated user has no
 *     endpoint that returns them, and RLS grants them no access to the table
 *     either (migration 20260803120000).
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<UserSearchParams>;
}) {
  const actor = await requireAdmin(PATH);
  const params = await searchParams;

  const filters: UserFilters = {
    role: parseRoleFilter(params.role),
    affiliation: parseAffiliationFilter(params.aff),
    search: parseSearchParam(params.q),
    rated: parseUserRatingFilter(params.rated),
  };

  const sort = parseUserSort(params.sort);
  const direction = parseSortDirection(
    params.dir,
    USER_SORT_DEFAULT_DIRECTION[sort]
  );
  const page = parsePage(params.page);

  const [
    { rows, summaries, total, pageCount, truncated },
    accountCount,
    adminCount,
    flaggedCount,
  ] = await Promise.all([
    listAdminUsers({ filters, sort, direction, page }),
    prisma.user.count(),
    prisma.user.count({ where: { role: { not: "user" } } }),
    countFlaggedUsers(),
  ]);

  // The canonical, sanitised view state — every link below is built from it, so
  // no link can carry a value the parsers would reject. `denied` is left out
  // deliberately: it is a one-shot message, and it should not follow the admin
  // around every time they sort a column.
  const view = {
    q: filters.search,
    role: filters.role === "all" ? undefined : filters.role,
    aff: filters.affiliation === "all" ? undefined : filters.affiliation,
    rated: filters.rated === "all" ? undefined : filters.rated,
    sort,
    dir: direction,
    page: page > 1 ? page : undefined,
  };

  function sortHref(column: UserSort): string {
    const next =
      column === sort
        ? flipDirection(direction)
        : USER_SORT_DEFAULT_DIRECTION[column];

    return buildAdminHref(PATH, view, {
      sort: column,
      dir: next,
      page: undefined,
    });
  }

  const actorIsSuperAdmin = actor.role === "super_admin";
  const isFiltered = hasActiveUserFilters(filters);

  return (
    <>
      <PageHeader
        title="Users"
        description={
          actorIsSuperAdmin
            ? "Everyone with an account — promote, demote or remove them."
            : "Everyone with an account. Only a super admin manages admins."
        }
      />

      <div className="flex flex-col gap-6">
        {params.denied === "super_admin" && (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              That action is restricted to super admins. It was refused on the
              server, not just hidden here.
            </span>
          </p>
        )}

        {accountCount === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-5" />}
            title="No accounts yet"
            description="Everyone who signs up — by email or with Google — appears here."
          />
        ) : (
          <>
            <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
              <Stat label="Accounts" value={accountCount} />
              <Stat label="Administrators" value={adminCount} />
              <Stat
                label={`Flagged (≤ ${FLAGGED_RATING_MAX})`}
                value={flaggedCount}
              />
              <Stat label="Your role" value={ROLE_LABEL[actor.role]} />
            </dl>

            <UserFilterBar
              filters={filters}
              sort={sort}
              direction={direction}
              resetHref={PATH}
              isFiltered={isFiltered}
            />

            {rows.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-5" />}
                title={
                  total > 0
                    ? "That page is past the end of the list"
                    : "No accounts match these filters"
                }
                description={
                  total > 0
                    ? `There ${total === 1 ? "is 1 account" : `are ${total} accounts`} to show, but not on this page.`
                    : "Nobody here fits every filter you have set. Use “Reset filters” to see every account again."
                }
                action={
                  total > 0 ? (
                    <LinkButton
                      href={buildAdminHref(PATH, view, { page: undefined })}
                      size="sm"
                      variant="secondary"
                    >
                      Back to the first page
                    </LinkButton>
                  ) : (
                    <LinkButton href={PATH} size="sm" variant="secondary">
                      Reset filters
                    </LinkButton>
                  )
                }
              />
            ) : (
              <>
                <div className="rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader
                          label="Name"
                          href={sortHref("name")}
                          direction={sort === "name" ? direction : null}
                          className="pl-5"
                        />
                        <TableHead>Email</TableHead>
                        {/* Affiliation and NIC fold into the Name cell below
                            `lg` — see the row for the copy that replaces them.
                            Nothing is dropped, it just moves. */}
                        <TableHead className="hidden lg:table-cell">
                          Affiliation
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          NIC
                        </TableHead>
                        <TableHead>Role</TableHead>
                        <SortableHeader
                          label="Conduct"
                          href={sortHref("rating")}
                          direction={sort === "rating" ? direction : null}
                        />
                        <TableHead className="text-right">Bookings</TableHead>
                        <SortableHeader
                          label="Joined"
                          href={sortHref("joined")}
                          direction={sort === "joined" ? direction : null}
                        />
                        <TableHead className="w-[4.5rem] pr-5 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {rows.map((u) => {
                        const isSelf = u.id === actor.id;
                        // Mirrors `loadTarget` in the actions: a plain admin may
                        // only act on plain users.
                        const canManage =
                          !isSelf && (actorIsSuperAdmin || u.role === "user");
                        const summary = summaries.get(u.id);

                        return (
                          <TableRow key={u.id}>
                            <TableCell className="pl-5 font-medium">
                              {/* The name is the obvious place to click to see a
                                  person, so it opens the same conduct record the
                                  Conduct column does. */}
                              <UserConductDialog
                                trigger="name"
                                triggerLabel={u.name ?? "—"}
                                userId={u.id}
                                label={u.name ?? u.email}
                                average={summary?.average ?? null}
                                count={summary?.count ?? 0}
                                canRate={canManage}
                              />
                              {/* Below `lg` the Affiliation and NIC columns are
                                  hidden to keep the table inside its container.
                                  They reappear here rather than being lost —
                                  NIC is admin-only either way, and this page is
                                  the only place in the app that prints it. */}
                              <span className="mt-0.5 block max-w-[22ch] truncate text-xs font-normal text-muted-foreground lg:hidden">
                                {affiliationLabel(u.affiliation)}
                                {u.nic ? (
                                  <>
                                    {" · "}
                                    <span className="font-mono">{u.nic}</span>
                                  </>
                                ) : null}
                              </span>
                            </TableCell>
                            <TableCell
                              title={u.email}
                              className="max-w-[18ch] truncate text-muted-foreground"
                            >
                              {u.email}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                              {u.affiliation ? (
                                AFFILIATION_LABEL[
                                  u.affiliation as AffiliationValue
                                ]
                              ) : (
                                // Every account created before this field
                                // existed lands here. Not an error — just not
                                // filled in yet.
                                <span className="text-xs italic">not set</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden font-mono text-xs whitespace-nowrap text-muted-foreground lg:table-cell">
                              {u.nic ?? (
                                <span className="font-sans italic">
                                  not set
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  u.role === "user" ? "secondary" : "default"
                                }
                              >
                                {ROLE_LABEL[u.role]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <UserConductDialog
                                userId={u.id}
                                label={u.name ?? u.email}
                                average={summary?.average ?? null}
                                count={summary?.count ?? 0}
                                canRate={canManage}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {u._count.bookings}
                            </TableCell>
                            {/* Date only — the minute an account was created is
                                never the question, and the full timestamp is
                                one hover away in the title. */}
                            <TableCell
                              title={formatDateTime(u.createdAt)}
                              className="text-xs whitespace-nowrap text-muted-foreground"
                            >
                              {formatDateOnly(u.createdAt)}
                            </TableCell>
                            <TableCell className="pr-5 text-right">
                              <UserRowActions
                                userId={u.id}
                                email={u.email}
                                role={u.role}
                                isSelf={isSelf}
                                canManage={canManage}
                                actorIsSuperAdmin={actorIsSuperAdmin}
                                bookingCount={u._count.bookings}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <PaginationBar
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  pageSize={ADMIN_PAGE_SIZE}
                  noun="accounts"
                  prevHref={
                    page > 1
                      ? // Page 1 is the bare URL, not `?page=1`.
                        buildAdminHref(PATH, view, {
                          page: page - 1 > 1 ? page - 1 : undefined,
                        })
                      : null
                  }
                  nextHref={
                    page < pageCount
                      ? buildAdminHref(PATH, view, { page: page + 1 })
                      : null
                  }
                />
              </>
            )}

            <div className="flex max-w-prose flex-col gap-3 text-sm text-muted-foreground">
              {truncated && (
                <p>
                  Sorting or filtering by conduct reads a capped slice of the
                  accounts, because the average lives in another table and
                  Postgres cannot page by it. That cap was reached here, so the
                  count above is a floor — narrow the search, role or
                  affiliation first and it becomes exact.
                </p>
              )}
              <p className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0" />
                <span>
                  NIC numbers and conduct ratings on this page are internal.
                  They appear nowhere on the public site, and a user cannot read
                  their own rating — the server refuses it and the database
                  policies refuse it independently.
                </span>
              </p>
              <p>
                The super admin role is never handed out from this panel — it is
                granted with database access (
                <code className="font-mono text-xs">
                  npm run make-admin -- &lt;email&gt; super_admin
                </code>
                ), so the panel can never mint an account able to remove you.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** The Affiliation column's text, for the narrow-screen line under the name. */
function affiliationLabel(affiliation: string | null): string {
  if (!affiliation) return "Affiliation not set";
  return AFFILIATION_LABEL[affiliation as AffiliationValue];
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
