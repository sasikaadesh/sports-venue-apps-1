import {
  FilterBarHeader,
  FilterChips,
  FilterField,
  FilterForm,
  FilterGrid,
  FilterInput,
  FilterSelect,
  SortPassthrough,
  type ChipOption,
} from "@/components/admin/filter-bar";
import type { UserFilters } from "@/lib/admin-users";
import type { SortDirection, UserSort } from "@/lib/admin-filters";
import { AFFILIATIONS } from "@/lib/validations";

/**
 * The Users filter bar — the same pattern as the Bookings one, with the
 * controls that fit this table.
 *
 * Ordering is not here: it moved onto the column headers, which is where an
 * admin looks for it. `sort`/`dir` ride through as hidden fields so changing a
 * filter keeps the column they chose.
 */

const ROLE_OPTIONS = [
  { value: "", label: "Any role" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super admins" },
];

const CONDUCT_OPTIONS: ChipOption[] = [
  { value: "", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "rated", label: "Rated" },
  { value: "unrated", label: "Not rated" },
];

export function UserFilterBar({
  filters,
  sort,
  direction,
  resetHref,
  isFiltered,
}: {
  filters: UserFilters;
  sort: UserSort;
  direction: SortDirection;
  resetHref: string;
  isFiltered: boolean;
}) {
  return (
    <FilterForm action="/admin/users">
      <SortPassthrough sort={sort} direction={direction} />

      <FilterBarHeader resetHref={resetHref} isFiltered={isFiltered} />

      <FilterGrid>
        <FilterField
          label="Search name or email"
          htmlFor="filter-q"
          className="sm:col-span-2"
        >
          <FilterInput
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.search}
            placeholder="e.g. perera, or ada@school.lk"
          />
        </FilterField>

        <FilterField label="Role" htmlFor="filter-role">
          <FilterSelect
            id="filter-role"
            name="role"
            defaultValue={filters.role === "all" ? "" : filters.role}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </FilterField>

        <FilterField label="Affiliation" htmlFor="filter-aff">
          <FilterSelect
            id="filter-aff"
            name="aff"
            defaultValue={
              filters.affiliation === "all" ? "" : filters.affiliation
            }
          >
            <option value="">Any affiliation</option>
            {AFFILIATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {/* Accounts created before the field existed. */}
            <option value="unset">Not set</option>
          </FilterSelect>
        </FilterField>
      </FilterGrid>

      <div className="border-t pt-4">
        <FilterChips
          name="rated"
          label="Conduct"
          options={CONDUCT_OPTIONS}
          value={filters.rated === "all" ? "" : filters.rated}
        />
      </div>
    </FilterForm>
  );
}
