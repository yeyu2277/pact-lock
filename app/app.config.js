export default defineAppConfig({
  ui: {
    colors: { primary: 'emerald', neutral: 'zinc' },
    icons: {
      arrowDown: 'i-pact-arrow-down', arrowLeft: 'i-pact-arrow-left', arrowRight: 'i-pact-arrow-right',
      check: 'i-pact-check', chevronDown: 'i-pact-caret-down', chevronLeft: 'i-pact-caret-left',
      chevronRight: 'i-pact-caret-right', chevronUp: 'i-pact-caret-down', close: 'i-pact-x',
      chevronDoubleLeft: 'i-pact-arrow-left', chevronDoubleRight: 'i-pact-arrow-right',
      copy: 'i-pact-copy', external: 'i-pact-arrow-square-out', loading: 'i-pact-spinner-gap',
      search: 'i-pact-magnifying-glass', minus: 'i-pact-x', plus: 'i-pact-plus',
    },
    button: { slots: { base: 'cursor-pointer font-medium justify-center' } },
    input: { slots: { base: 'w-full' } },
    modal: { slots: { footer: 'justify-end' } },
  },
})
