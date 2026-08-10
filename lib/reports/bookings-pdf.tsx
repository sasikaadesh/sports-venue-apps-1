import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  REPORT_COLUMNS,
  type BookingReport,
  type ReportRow,
} from "@/lib/booking-report";

/**
 * The PDF renderer for the bookings report.
 *
 * The second of the two renderers of `BookingReport` — /admin/bookings/print is
 * the first. Neither of them decides *what* the report says; both render the
 * same structure, so Print and Export PDF are the same document on different
 * media. Columns, totals and wording all come from `lib/booking-report.ts`.
 *
 * ## Why a real PDF rather than "print to PDF"
 *
 * The browser's own print-to-PDF is at the mercy of the machine it runs on —
 * page size, margins, whether background graphics are on, whether the admin
 * remembers to pick A4. A report that gets emailed to a club treasurer has to
 * come out the same every time, so it is generated on the server.
 *
 * ## Why react-pdf
 *
 * `@react-pdf/renderer` draws the document directly and runs in a plain Node
 * function. The alternative — headless Chrome rendering the print page — means
 * shipping a ~50 MB browser into a Vercel function and a cold start measured in
 * seconds, for a black-and-white table.
 *
 * The trade is that this file cannot reuse the print page's Tailwind: react-pdf
 * has its own small flexbox/StyleSheet layer and none of the project's CSS
 * tokens. So the styles below are the print stylesheet's palette (from the
 * `@media print` block in globals.css) restated in the only vocabulary this
 * renderer has — black text, grey rules, no accent, no fills.
 *
 * Fonts are the PDF standard Helvetica rather than the site's Space Grotesk.
 * Registering a webfont means fetching a TTF at request time inside the
 * function, which is a network call and a failure mode on the path of a
 * download; Helvetica is embedded in every PDF reader and is the same kind of
 * clean grotesque.
 */

/** The print palette from globals.css, in the only form react-pdf understands. */
const INK = "#000000";
const MUTED = "#3f3f46";
const RULE = "#a1a1aa";

const styles = StyleSheet.create({
  page: {
    // A4 with the same hole-punchable margin as the `@page` rule.
    paddingTop: 40,
    paddingBottom: 52, // room for the fixed footer
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: INK,
    lineHeight: 1.4,
  },

  // --- Masthead ---
  masthead: {
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 4 },
  meta: { fontSize: 8, color: MUTED, marginTop: 4 },

  // --- Sections ---
  section: { marginBottom: 16 },
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  muted: { color: MUTED },

  appliedList: { flexDirection: "row", flexWrap: "wrap" },
  appliedItem: { flexDirection: "row", marginRight: 18, marginBottom: 2 },
  appliedValue: { fontFamily: "Helvetica-Bold", textTransform: "capitalize" },

  // --- Summary strip ---
  figures: { flexDirection: "row", gap: 6 },
  figure: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: RULE,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  figureLabel: {
    fontSize: 6.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: MUTED,
  },
  figureValue: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 2 },
  figureNote: { fontSize: 6.5, color: MUTED, marginTop: 2 },
  summaryNote: { fontSize: 6.5, color: MUTED, marginTop: 6 },

  // --- Table ---
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1.2,
    borderBottomColor: INK,
    paddingBottom: 4,
  },
  headCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 3,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 4,
  },
  cell: { paddingHorizontal: 3 },

  empty: {
    borderWidth: 0.5,
    borderColor: RULE,
    borderStyle: "dashed",
    padding: 18,
    color: MUTED,
  },
  truncated: { fontFamily: "Helvetica-Bold", marginTop: 12 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
  },
});

/**
 * Column widths as percentage strings.
 *
 * react-pdf has no table layout algorithm — a "table" is flex rows — so every
 * cell in a column has to be given the same explicit width or the columns
 * wander from row to row.
 */
const COLUMN_WIDTHS = REPORT_COLUMNS.map(
  (column) => `${(column.width * 100).toFixed(2)}%` as const
);

export function BookingsReportDocument({ report }: { report: BookingReport }) {
  return (
    <Document
      title={`${report.title} — ${report.range}`}
      author={report.brand}
      subject={`${report.range}. ${report.sortLine}`}
      creator={report.brand}
    >
      <Page size="A4" style={styles.page}>
        {/* --- Masthead --- */}
        <View style={styles.masthead}>
          <Text style={styles.brand}>{report.brand}</Text>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.meta}>
            {report.range} · generated {report.generatedAt}
          </Text>
        </View>

        {/* --- What this is a report of --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Filters applied</Text>
          {report.applied.length === 0 ? (
            <Text style={styles.muted}>
              None beyond the date range above — every booking and admin block
              in the period.
            </Text>
          ) : (
            <View style={styles.appliedList}>
              {report.applied.map((item) => (
                <View key={item.label} style={styles.appliedItem}>
                  <Text style={styles.muted}>{item.label}: </Text>
                  <Text style={styles.appliedValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.muted}>{report.sortLine}</Text>
        </View>

        {/* --- Summary, counted over the whole filtered set --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Summary</Text>
          <View style={styles.figures}>
            {report.figures.map((figure) => (
              <View key={figure.label} style={styles.figure}>
                <Text style={styles.figureLabel}>{figure.label}</Text>
                <Text style={styles.figureValue}>{figure.value}</Text>
                {figure.note ? (
                  <Text style={styles.figureNote}>{figure.note}</Text>
                ) : null}
              </View>
            ))}
          </View>
          <Text style={styles.summaryNote}>{report.summaryNote}</Text>
        </View>

        {/* --- The rows --- */}
        {report.rows.length === 0 ? (
          <Text style={styles.empty}>
            Nothing matched these filters, so there is nothing to report. Go
            back and widen the date range.
          </Text>
        ) : (
          <View>
            {/* `fixed` repeats the head on every page — the paper equivalent of
                `thead { display: table-header-group }` in the print CSS. */}
            <View style={styles.headRow} fixed>
              {REPORT_COLUMNS.map((column, index) => (
                <Text
                  key={column.key}
                  style={[
                    styles.headCell,
                    { width: COLUMN_WIDTHS[index], textAlign: column.align },
                  ]}
                >
                  {column.label}
                </Text>
              ))}
            </View>

            {report.rows.map((row) => (
              // No row is split down the middle by a page break.
              <View key={row.id} style={styles.row} wrap={false}>
                {REPORT_COLUMNS.map((column, index) => (
                  <Text
                    key={column.key}
                    style={[
                      styles.cell,
                      {
                        width: COLUMN_WIDTHS[index],
                        textAlign: column.align,
                        ...(column.key === "status"
                          ? { textTransform: "capitalize" as const }
                          : {}),
                      },
                    ]}
                  >
                    {row[column.key as keyof ReportRow]}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {report.truncated ? (
          <Text style={styles.truncated}>
            This report stops at the first {report.rowLimit} rows. The summary
            above still covers all {report.totalCount} — narrow the date range
            to list every one of them.
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {report.brand} · internal booking report · generated{" "}
            {report.generatedAt}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Render the report to PDF bytes, ready to stream back as a download. */
export function renderBookingsReportPdf(report: BookingReport) {
  return renderToBuffer(<BookingsReportDocument report={report} />);
}
