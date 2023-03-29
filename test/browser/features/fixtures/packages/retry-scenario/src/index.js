import BugsnagPerformance from '@bugsnag/js-performance-browser'

const apiKey = decodeURIComponent(window.location.search.match(/API_KEY=([^&]+)/)[1])
const endpoint = decodeURIComponent(window.location.search.match(/ENDPOINT=([^&]+)/)[1])

BugsnagPerformance.start({ apiKey, endpoint, maximumBatchSize: 1 })

document.getElementById("send-span").addEventListener("click", () => {
    BugsnagPerformance.startSpan("Custom/Deliver").end()
})

BugsnagPerformance.startSpan("Custom/Reject").end()