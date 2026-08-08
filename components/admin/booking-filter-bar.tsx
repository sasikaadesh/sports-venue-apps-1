import {
  FilterBarHeader,
  FilterChips,
  FilterCombobox,
  FilterField,
  FilterForm,
  FilterGrid,
  FilterInput,
  FilterSelect,
  SortPassthrough,
  type ChipOption,
} from "@/components/admin/filter-bar";
import type {
  BookingFilters,
  BookingFilterOptions,
} from "@/lib/admin-bookings";
import type { BookingSort, SortDirection } from "@/lib/admin-filters";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

/**
 * The Bookings filter bar.
 *
 * A server component composing the client controls in `filter-bar.tsx`: the
 * dropdown contents come from the database on the server, and only the small
 * interactive shell ships to the browser.
 *
 * Every control is a field of one form, so the filters AND together and a
 * change to any of them re-queries the table server-side. See `filter-bar.tsx`
 * for how the form maps onto the query string.
 */

// "Any" is the empty value, not the literal "all", so the default view stays a
// bare /admin/bookings instead of carrying a redundant `?pay=all`.
const PAYMENT_OPTIONS: ChipOption[] = [
  { value: "", label: "Any" },
  { value: "success", label: "Paid" },
  { value: "pending", label: "Awaiting" },
  { value: "failed", label: "Failed" },
  { value: "unpaid", label: "Unpaid" },
];

export function BookingFilterBar({
  statuses,
  options,
  filters,
  sort,
  direction,
  resetHref,
  isFiltered,
}: {
  statuses: readonly BookingStatus[];
  options: BookingFilterOptions;
  filters: BookingFilters;
  sort: BookingSort;
  direction: SortDirection;
  resetHref: string;
  isFiltered: boolean;
}) {
  const statusOptions: ChipOption[] = [
    { value: "", label: "All" },
    ...statuses.map((s) => ({ value: s, label: s })),
  ];

  return (
    <FilterForm action="/admin/bookings">
      <SortPassthrough sort={sort} direction={direction} />

      <FilterBarHeader resetHref={resetHref} isFiltered={isFiltered} />

      <FilterGrid>
        <FilterField label="Court" htmlFor="filter-court">
          <FilterSelect
            id="filter-court"
            name="court"
            defaultValue={filters.courtId ?? ""}
          >
            <option value="">All courts</option>
            {options.courts.map((court) => (
              <option key={court.id} value={court.id}>
                {/* A retired court still has bookings in the table, so it stays
                    selectable — flagged, so the name is not confusing. */}
                {court.isActive ? court.name : `${court.name} (retired)`}
              </option>
            ))}
          </FilterSelect>
        </FilterField>

        <FilterField label="Who" htmlFor="filter-user">
          <FilterCombobox
            id="filter-user"
            name="user"
            queryName="uq"
            selectedId={filters.userId}
            query={filters.userQuery}
            placeholder="Anyone — type to search"
            options={options.users.map((user) => ({
              id: user.id,
              // The email is part of the label, not a subtitle: two people can
              // share a name, and the label is what the typed text is matched
              // against to resolve an id.
              label: user.name ? `${user.name} — ${user.email}` : user.email,
            }))}
          />
        </FilterField>

        <FilterField label="From date" htmlFor="filter-from">
          <FilterInput
            id="filter-from"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </FilterField>

        <FilterField label="To date" htmlFor="filter-to">
          <FilterInput
            id="filter-to"
            name="to"
            type="date"
            defaultValue={filters.to}
          />
        </FilterField>
      </FilterGrid>

      <div className="flex flex-col gap-3 border-t pt-4">
        <FilterChips
          name="status"
          label="Status"
          options={statusOptions}
          value={filters.status ?? ""}
        />
        <FilterChips
          name="pay"
          label="Payment"
          options={PAYMENT_OPTIONS}
          value={filters.payment === "all" ? "" : filters.payment}
        />
      </div>
    </FilterForm>
  );
}
