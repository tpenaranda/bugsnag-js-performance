Feature: Retries

    Scenario Outline: Batch is retried with specified status codes
        Given I set the HTTP status code for the next "POST" request to <status>
        And I navigate to the test URL "/retry-scenario"

        # We need to wait for 2 traces, but maze-runner will log the rejected payload as well
        And I wait to receive 3 traces

        # 500 - First payload (rejected, then retried)
        Then a span name equals "Custom/Span 1"

        # 200 - Second payload (delivered)
        And a span name equals "Custom/Span 2"

        Examples:
            | status | definition                    |
            | 402    | Payment Required              |
            | 407    | Proxy Authentication Required |
            | 408    | Request Timeout               |
            | 429    | Too Many Requests             |
            | 500    | Connection Error              |

    # Status code 408 cannot be tested on certain browsers as it
    # is automatically retried and does not behave as expected
    Scenario Outline: Oldest batch is removed when max retry queue size is exceeded
        Given I set the HTTP status code for the next 4 "POST" requests to <status>
        And I navigate to the test URL "/oldest-batch-removed"
        And I wait to receive 1 trace
        And I discard the oldest trace

        Then I click the DOM element "send-spans"
        And I wait to receive 3 traces

        # Remove failed requests
        And I discard the oldest trace
        And I discard the oldest trace
        And I discard the oldest trace

        Then I click the DOM element "send-final-span"
        And I wait to receive 4 traces

        # First successful batch
        Then a span name equals "Custom/Span to deliver"

        # Retried batches
        And a span name equals "Custom/Span to retry 1"
        And a span name equals "Custom/Span to retry 2"
        And a span name equals "Custom/Span to retry 3"

        Examples:
            | status | definition                    |
            | 402    | Payment Required              |
            | 407    | Proxy Authentication Required |
            # | 408    | Request Timeout               |
            | 429    | Too Many Requests             |
            | 500    | Connection Error              |
