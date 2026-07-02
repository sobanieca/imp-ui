# `imp lint` rule — single props object per factory call

Flag passing more than one props object to a single element factory call (e.g.
`div(propsA, propsB, ...)`). Only one props object per call is supported; the runtime warns, but
lint should catch it statically.
