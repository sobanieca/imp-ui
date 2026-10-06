# chart - a column, bar or line chart of one or more series over shared categories

```js
import { chart } from 'imp/std/data'

chart({
  label: 'Revenue per quarter',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { name: 'Product', values: [12, 18, 9, 22], color: 'blue' },
    { name: 'Services', values: [5, 7, 11, 8] },
  ],
})
chart({ type: 'bar', label: 'Open tickets', labels: teams, series: [{ name: 'Open', values }] })
chart({ type: 'line', label: 'Response time', labels: months, series: latency })
chart({ label: 'Revenue', labels, series, stacked: true })
```

The call shape is `chart(props)`. The chart takes no children.

| Prop      | Values                                              | Default       | Notes                                                       |
| --------- | --------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| `type`    | `'column'`, `'bar'`, `'line'`                       | `'column'`    | `column` is vertical bars, `bar` is horizontal bars         |
| `label`   | string, or a state holding one - **live**           | -             | The accessible name, and the caption of the data table      |
| `labels`  | array of strings, or a state holding one - **live** | `[]`          | The categories, one per band                                |
| `series`  | array of series, or a state holding one - **live**  | `[]`          | See the table below                                         |
| `stacked` | boolean                                             | `false`       | `column` and `bar` only. `false` draws the series in groups |
| `legend`  | boolean                                             | more than one | Without it, the legend shows for two or more series         |
| `format`  | `(value) => string`                                 | locale number | Formats the axis ticks, the readout and the data table      |

One entry of `series`:

| Key      | Values                      | Notes                                                                                     |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `name`   | string                      | Shown in the legend, the readout and the data table                                       |
| `values` | array of numbers, or `null` | One value per entry of `labels`. `null` draws nothing                                     |
| `color`  | a theme palette name        | Default by position: `blue`, `orange`, `pink`, `cyan`, `purple`, `green`, `indigo`, `red` |

The height is the custom property `--imp-chart-block-size` on the host. The default is `16rem`. A
`bar` chart without it takes its height from the number of rows. The chart fills the inline size of
its container.

Rules an agent gets wrong:

- **Import the component from `imp/std/data`**, not from `imp/std`.
- **There is one data shape.** Always pass `labels` and `series`, also for one series. There is no
  `values` prop and no `data` prop.
- **`color` is a palette name, not a CSS colour.** Write `color: 'teal'`. imp warns about another
  value and uses the default of that position. The palette names are `gray`, `brown`, `red`,
  `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`,
  `purple`, `pink`. The light names (`amber`, `yellow`, `lime`, `sky`) are hard to see on a light
  surface.
- **Pass the state itself for live data.** Write `series: sales`, never `series: sales.get()`. The
  chart draws the plot again on each change. The host and the plot element stay.
- **There are no axis props.** The value axis of `column` and `bar` starts at zero. The axis of
  `line` follows the range of the data. imp rounds the ends and draws about five grid lines. A
  negative value draws under the zero line.
- **`stacked` with `type: 'line'` does nothing.** imp warns and draws plain lines.
- **Always pass `label`.** The plot is `role="img"` with that name. A hidden `<table>` holds the
  same data for a screen reader. imp warns when `label` is missing.
- **Write no hover or key handling.** A pointer over a category shows a readout of every series. The
  plot is one tab stop. The arrow keys, `Home`, `End` and `Escape` move the readout. `bar` uses the
  vertical arrows. The horizontal arrows mirror in RTL. A status region outside the plot speaks the
  readout, because the plot is an image and a screen reader reads nothing inside it.
- **The chart is not interactive beyond the readout.** There is no click event, no selection and no
  zoom. Put a control next to the chart when the person must pick something.
- **More than eight series repeat the colours.** imp warns. Show fewer series, or draw two charts.
- **Do not put two measures with different units in one chart.** There is one value axis. Draw two
  charts.
- A `column` or `line` chart shows only some of the category labels when they do not fit. That
  happens above 12 categories, and from 7 categories when the labels are wider than the space for
  them. The chart checks again when its width changes. Fewer than 7 categories end with an ellipsis.
  More than 24 points on a line hide the dots until the pointer is over them.

```js
import { component } from 'imp'
import { initState } from 'imp/state'
import { chart } from 'imp/std/data'

export const ordersChart = component('my-app-orders-chart', {
  setup: (self) => {
    const orders = initState(self, 'orders.week', [
      { name: 'Online', values: [120, 98, 143, 131, 160, 88, 72] },
      { name: 'In store', values: [60, 54, 71, 66, 90, 110, 40] },
    ])
    return chart({
      label: 'Orders per day, this week',
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      series: orders,
      stacked: true,
      format: (value) => `${value} orders`,
    })
  },
})
```

Related: imp skill std/gantt - tasks over time; imp skill theming - the palette behind the `color`
names; imp skill state - the state that a live prop takes.
