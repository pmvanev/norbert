# Research: OTLP JSON Wire Format Specification for Logs and Metrics

**Date**: 2026-03-23 | **Researcher**: nw-researcher (Nova) | **Confidence**: High | **Sources**: 8

## Executive Summary

This document provides a comprehensive specification of the OTLP/HTTP JSON wire format for logs and metrics signals, targeting implementors building custom OTLP receivers. Every field, type, encoding rule, and edge case is documented from the official OpenTelemetry protobuf definitions and OTLP specification v1.10.0.

The key implementation-critical findings are: (1) all 64-bit integers (including `timeUnixNano`, `intValue`, and data point counts) are JSON-encoded as **decimal strings**, not numbers; (2) `traceId` and `spanId` use **hex encoding**, not base64; (3) enum fields (like `severityNumber` and `aggregationTemporality`) MUST be **integer values only**, not name strings; (4) the `AnyValue` union has **7 variants** (string, bool, int64, double, array, kvlist, bytes); and (5) a receiver should return HTTP 200 with an empty `{}` JSON body for full success, with `partialSuccess` populated only when rejecting some records.

A critical practical observation: SDKs may encode numeric attribute values as `stringValue` instead of `intValue` when the source data arrives as strings (e.g., from environment variables). The spec uses SHOULD language for type mapping, making this implementation-dependent. A robust receiver must handle both `intValue` and `stringValue` for numeric attributes.

## Research Methodology

**Search Strategy**: Direct fetch of official OpenTelemetry specification pages (opentelemetry.io/docs/specs/), protobuf source files from the opentelemetry-proto GitHub repository, and the OTel common specification for attribute type mapping. Supplemented with web searches for SDK encoding behavior specifics.
**Source Selection**: Types: official specification, protobuf definitions, GitHub source | Reputation: High (1.0) for all primary sources | Verification: cross-referenced protobuf definitions against specification text and data model docs.
**Quality Standards**: Min 3 sources/claim | All major claims cross-referenced | Avg reputation: 1.0

---

## Findings

### Finding 1: AnyValue Has 7 Variants (Plus 1 Alpha-Only)

**Evidence**: The `common.proto` defines:

```protobuf
message AnyValue {
  oneof value {
    string string_value = 1;
    bool bool_value = 2;
    int64 int_value = 3;
    double double_value = 4;
    ArrayValue array_value = 5;
    KeyValueList kvlist_value = 6;
    bytes bytes_value = 7;
  }
}
```

In JSON encoding, these map to the camelCase field names in the `value` oneof:

| Protobuf Field | JSON Key | JSON Value Type | Notes |
|---|---|---|---|
| `string_value` | `stringValue` | `string` | UTF-8 strings |
| `bool_value` | `boolValue` | `boolean` | `true` / `false` |
| `int_value` | `intValue` | `string` | 64-bit signed int, encoded as decimal string |
| `double_value` | `doubleValue` | `number` | IEEE 754 double |
| `array_value` | `arrayValue` | `object` | Contains `{"values": [AnyValue, ...]}` |
| `kvlist_value` | `kvlistValue` | `object` | Contains `{"values": [{"key": "k", "value": AnyValue}, ...]}` |
| `bytes_value` | `bytesValue` | `string` | Standard base64-encoded (NOT hex) |

There is an 8th field (`string_value_strindex = 8`) but it is alpha-only for the profiling signal and should not appear in logs or metrics payloads.

An AnyValue with no field set represents an empty/null value.

**Source**: [opentelemetry-proto common.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [OTel Common Specification](https://opentelemetry.io/docs/specs/otel/common/), [Attribute Type Mapping](https://opentelemetry.io/docs/specs/otel/common/attribute-type-mapping/), [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)

---

### Finding 2: intValue Is a Decimal String, but SDKs May Use stringValue for Numbers

**Evidence**: The OTLP JSON encoding specification states: "64-bit integer numbers in JSON-encoded payloads are encoded as decimal strings, and either numbers or strings are accepted when decoding." This means `intValue` in JSON is always a string:

```json
{"key": "input_tokens", "value": {"intValue": "337"}}
```

However, Claude Code sends `{"stringValue": "337"}` for token counts. This is explained by the attribute type mapping specification, which states: "Integer values which are within the range of 64 bit signed numbers [-2^63..2^63-1] SHOULD be converted to AnyValue's int_value field." The keyword is SHOULD, not MUST. When an SDK receives a value that is already a string (e.g., from environment variables or internal string representations), it may preserve the string type rather than parsing and re-encoding as intValue.

**Implication for parser design**: A robust OTLP receiver MUST handle numeric attributes arriving as either `intValue` (string-encoded integer) or `stringValue` (string that happens to contain digits). Both are spec-compliant.

**Source**: [OTLP Specification - JSON Encoding](https://opentelemetry.io/docs/specs/otlp/) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Attribute Type Mapping](https://opentelemetry.io/docs/specs/otel/common/attribute-type-mapping/), [OTel Common Specification](https://opentelemetry.io/docs/specs/otel/common/), [Claude Code Actual Emissions Research](docs/research/claude-code-otel-telemetry-actual-emissions.md)
**Analysis**: This is not a bug in Claude Code. The spec uses SHOULD language for type selection, making it implementation-dependent. The practical consequence is that your parser cannot assume numeric attributes will always use `intValue`. Design the attribute extraction layer to attempt numeric parsing from both `intValue` and `stringValue`.

---

### Finding 3: Complete ExportLogsServiceRequest JSON Schema

**Evidence**: The full JSON structure, derived from the protobuf definitions with camelCase field name conversion:

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          {"key": "service.name", "value": {"stringValue": "claude-code"}}
        ],
        "droppedAttributesCount": 0
      },
      "scopeLogs": [
        {
          "scope": {
            "name": "scope-name",
            "version": "1.0.0",
            "attributes": [],
            "droppedAttributesCount": 0
          },
          "logRecords": [
            {
              "timeUnixNano": "1774290629936000000",
              "observedTimeUnixNano": "1774290629936000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": {"stringValue": "log message body"},
              "attributes": [
                {"key": "event.name", "value": {"stringValue": "claude_code.api_request"}},
                {"key": "input_tokens", "value": {"stringValue": "337"}}
              ],
              "droppedAttributesCount": 0,
              "flags": 0,
              "traceId": "0af7651916cd43dd8448eb211c80319c",
              "spanId": "b7ad6b7169203331",
              "eventName": "claude_code.api_request"
            }
          ],
          "schemaUrl": ""
        }
      ],
      "schemaUrl": ""
    }
  ]
}
```

#### Resource Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `attributes` | `repeated KeyValue` | `array` | Key-value pairs |
| `droppedAttributesCount` | `uint32` | `number` | Count of attributes dropped due to limits |
| `entityRefs` | `repeated EntityRef` | `array` | Entity references (newer addition) |

#### InstrumentationScope (scope) Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `name` | `string` | `string` | Instrumentation library name |
| `version` | `string` | `string` | Library version |
| `attributes` | `repeated KeyValue` | `array` | Scope-level attributes |
| `droppedAttributesCount` | `uint32` | `number` | Dropped attribute count |

#### LogRecord Fields (ALL fields)

| Field | Protobuf Type | JSON Type | Required? | Notes |
|---|---|---|---|---|
| `timeUnixNano` | `fixed64` | `string` | Optional | Nanoseconds since epoch, decimal string |
| `observedTimeUnixNano` | `fixed64` | `string` | Recommended | When collector/SDK observed the event |
| `severityNumber` | `enum (int)` | `number` | Optional | Integer 0-24 (see severity table below) |
| `severityText` | `string` | `string` | Optional | Original severity string (e.g., "INFO") |
| `body` | `AnyValue` | `object` | Optional | Any AnyValue type, not just stringValue |
| `attributes` | `repeated KeyValue` | `array` | Optional | Log record attributes |
| `droppedAttributesCount` | `uint32` | `number` | Optional | Attributes dropped due to limits |
| `flags` | `fixed32` | `number` | Optional | Bitmask; low 8 bits = W3C trace flags |
| `traceId` | `bytes` | `string` | Optional | 32-char hex string (NOT base64) |
| `spanId` | `bytes` | `string` | Optional | 16-char hex string (NOT base64) |
| `eventName` | `string` | `string` | Optional | Event class identifier (field 12) |

Note: In protobuf, all fields are technically optional. The OTel data model recommends `observedTimeUnixNano` SHOULD always be set. The `body` field can be ANY `AnyValue` type -- not just `stringValue`. It could be a `kvlistValue` containing structured data.

#### `droppedAttributesCount` Explanation

This field is non-zero when the SDK or collector has been configured with an attribute count limit and the source data exceeded that limit. For example, if `OTEL_ATTRIBUTE_COUNT_LIMIT=128` and a log record has 150 attributes, `droppedAttributesCount` would be 22. The receiver should record this value for observability but cannot recover the dropped attributes.

#### SeverityNumber Values

| Range | Name | Values |
|---|---|---|
| Unspecified | UNSPECIFIED | 0 |
| Trace | TRACE, TRACE2, TRACE3, TRACE4 | 1, 2, 3, 4 |
| Debug | DEBUG, DEBUG2, DEBUG3, DEBUG4 | 5, 6, 7, 8 |
| Info | INFO, INFO2, INFO3, INFO4 | 9, 10, 11, 12 |
| Warn | WARN, WARN2, WARN3, WARN4 | 13, 14, 15, 16 |
| Error | ERROR, ERROR2, ERROR3, ERROR4 | 17, 18, 19, 20 |
| Fatal | FATAL, FATAL2, FATAL3, FATAL4 | 21, 22, 23, 24 |

**Source**: [opentelemetry-proto logs.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/logs/v1/logs.proto) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [OTel Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [opentelemetry-proto resource.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/resource/v1/resource.proto), [opentelemetry-proto common.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto)

---

### Finding 4: Complete ExportMetricsServiceRequest JSON Schema

**Evidence**: The full JSON structure derived from protobuf definitions:

```json
{
  "resourceMetrics": [
    {
      "resource": {
        "attributes": [
          {"key": "service.name", "value": {"stringValue": "claude-code"}}
        ],
        "droppedAttributesCount": 0
      },
      "scopeMetrics": [
        {
          "scope": {
            "name": "scope-name",
            "version": "1.0.0",
            "attributes": [],
            "droppedAttributesCount": 0
          },
          "metrics": [
            {
              "name": "claude_code.tokens",
              "description": "Token usage",
              "unit": "tokens",
              "sum": {
                "dataPoints": [
                  {
                    "attributes": [
                      {"key": "session.id", "value": {"stringValue": "abc-123"}}
                    ],
                    "startTimeUnixNano": "1774290000000000000",
                    "timeUnixNano": "1774290629936000000",
                    "asDouble": 337.0,
                    "exemplars": [],
                    "flags": 0
                  }
                ],
                "aggregationTemporality": 2,
                "isMonotonic": true
              }
            }
          ],
          "schemaUrl": ""
        }
      ],
      "schemaUrl": ""
    }
  ]
}
```

#### Metric Types (oneof `data`)

The `Metric` message contains a oneof with 5 possible types:

| Type | Field Number | Data Points Type | Has Temporality? | Notes |
|---|---|---|---|---|
| `gauge` | 5 | `NumberDataPoint` | No | Instantaneous measurement |
| `sum` | 7 | `NumberDataPoint` | Yes | Additive quantity (counters) |
| `histogram` | 9 | `HistogramDataPoint` | Yes | Bucket distribution |
| `exponentialHistogram` | 10 | `ExponentialHistogramDataPoint` | Yes | Exponential bucket distribution |
| `summary` | 11 | `SummaryDataPoint` | No | Legacy quantile summary |

Only ONE of these is set per Metric. A metric does NOT switch types across exports -- that would be a protocol violation.

#### Metric-Level Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `name` | `string` | `string` | Metric name (e.g., "claude_code.tokens") |
| `description` | `string` | `string` | Human-readable description |
| `unit` | `string` | `string` | Unit of measurement |
| `metadata` | `repeated KeyValue` | `array` | Metric-level metadata (field 12) |

#### AggregationTemporality Enum

| Value | Name | Meaning |
|---|---|---|
| 0 | `UNSPECIFIED` | Not specified |
| 1 | `DELTA` | Values represent change since last report. Time ranges: (T0,T1], (T1,T2], ... |
| 2 | `CUMULATIVE` | Values represent cumulative total since start. Time ranges: (T0,T1], (T0,T2], ... |

Encoded as integer in JSON: `"aggregationTemporality": 1` for DELTA, `"aggregationTemporality": 2` for CUMULATIVE.

#### NumberDataPoint Fields (used by Gauge and Sum)

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `attributes` | `repeated KeyValue` | `array` | Data point dimensions |
| `startTimeUnixNano` | `fixed64` | `string` | Start of measurement window |
| `timeUnixNano` | `fixed64` | `string` | Time of measurement |
| `asDouble` | `double` | `number` | Value as double (oneof `value`) |
| `asInt` | `sfixed64` | `string` | Value as int64, decimal string (oneof `value`) |
| `exemplars` | `repeated Exemplar` | `array` | Trace-linked examples |
| `flags` | `uint32` | `number` | DataPointFlags bitmask |

Only ONE of `asDouble` or `asInt` is set per data point.

#### HistogramDataPoint Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `attributes` | `repeated KeyValue` | `array` | Dimensions |
| `startTimeUnixNano` | `fixed64` | `string` | Window start |
| `timeUnixNano` | `fixed64` | `string` | Measurement time |
| `count` | `fixed64` | `string` | Total observation count |
| `sum` | `optional double` | `number` | Sum of all observed values |
| `bucketCounts` | `repeated fixed64` | `array of string` | Count per bucket |
| `explicitBounds` | `repeated double` | `array of number` | Bucket boundaries |
| `exemplars` | `repeated Exemplar` | `array` | Trace-linked examples |
| `flags` | `uint32` | `number` | DataPointFlags |
| `min` | `optional double` | `number` | Minimum observed value |
| `max` | `optional double` | `number` | Maximum observed value |

Bucket layout: N bounds produce N+1 buckets. `bucketCounts` has length `explicitBounds.length + 1`. Buckets are `(-inf, bound[0]], (bound[0], bound[1]], ..., (bound[N-1], +inf)`.

#### ExponentialHistogramDataPoint Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `attributes` | `repeated KeyValue` | `array` | Dimensions |
| `startTimeUnixNano` | `fixed64` | `string` | Window start |
| `timeUnixNano` | `fixed64` | `string` | Measurement time |
| `count` | `fixed64` | `string` | Total count |
| `sum` | `optional double` | `number` | Sum of values |
| `scale` | `sint32` | `number` | Bucket resolution |
| `zeroCount` | `fixed64` | `string` | Count of zero values |
| `positive` | `Buckets` | `object` | `{"offset": number, "bucketCounts": ["string", ...]}` |
| `negative` | `Buckets` | `object` | Same structure as positive |
| `flags` | `uint32` | `number` | DataPointFlags |
| `exemplars` | `repeated Exemplar` | `array` | Trace-linked examples |
| `min` | `optional double` | `number` | Minimum value |
| `max` | `optional double` | `number` | Maximum value |
| `zeroThreshold` | `double` | `number` | Width of zero bucket |

#### SummaryDataPoint Fields (Legacy)

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `attributes` | `repeated KeyValue` | `array` | Dimensions |
| `startTimeUnixNano` | `fixed64` | `string` | Window start |
| `timeUnixNano` | `fixed64` | `string` | Measurement time |
| `count` | `fixed64` | `string` | Observation count |
| `sum` | `double` | `number` | Sum of values |
| `quantileValues` | `repeated ValueAtQuantile` | `array` | `[{"quantile": 0.99, "value": 123.4}]` |
| `flags` | `uint32` | `number` | DataPointFlags |

#### Exemplar Fields

| Field | Protobuf Type | JSON Type | Notes |
|---|---|---|---|
| `filteredAttributes` | `repeated KeyValue` | `array` | Attributes not in data point |
| `timeUnixNano` | `fixed64` | `string` | When exemplar was recorded |
| `asDouble` | `double` | `number` | Value as double (oneof) |
| `asInt` | `sfixed64` | `string` | Value as int64 (oneof) |
| `spanId` | `bytes` | `string` | Hex-encoded (NOT base64) |
| `traceId` | `bytes` | `string` | Hex-encoded (NOT base64) |

#### DataPointFlags Enum

| Value | Name | Meaning |
|---|---|---|
| 0 | `DO_NOT_USE` | Default / not set |
| 1 | `NO_RECORDED_VALUE_MASK` | Explicitly missing data (staleness marker) |

**Source**: [opentelemetry-proto metrics.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/metrics/v1/metrics.proto) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [OTel Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/), [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/), [opentelemetry-proto common.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto)

---

### Finding 5: JSON Encoding Rules -- Critical Differences from Standard Protobuf JSON

**Evidence**: The OTLP specification defines several deviations from standard protobuf JSON mapping:

#### 64-bit Integer Encoding

All 64-bit integer types (`int64`, `uint64`, `fixed64`, `sfixed64`) are encoded as **decimal strings** in JSON to avoid JavaScript precision loss beyond 2^53:

```json
"timeUnixNano": "1774290629936000000"
"intValue": "337"
"count": "42"
"asInt": "-15"
```

Decoders SHOULD accept both string and number forms, but encoders MUST produce strings.

#### traceId and spanId: Hex Encoding (NOT Base64)

Unlike standard protobuf JSON mapping which uses base64 for `bytes` fields, OTLP specifies: "The traceId and spanId byte arrays are represented as case-insensitive hex-encoded strings."

```json
"traceId": "0af7651916cd43dd8448eb211c80319c"
"spanId": "b7ad6b7169203331"
```

- traceId: 32 hex characters (16 bytes)
- spanId: 16 hex characters (8 bytes)
- Case-insensitive on decode

Other `bytes` fields (like `bytesValue` in AnyValue) use standard base64 encoding.

#### Enum Fields: Integer Only

"Values of enum fields MUST be encoded as integer values." Name strings are NOT allowed:

```json
"severityNumber": 9
"aggregationTemporality": 2
```

NOT: `"severityNumber": "SEVERITY_NUMBER_INFO"` (rejected)

#### Double/Float Values

Standard JSON number representation. No string encoding:

```json
"asDouble": 337.0
"sum": 1234.56
```

Special values: NaN as `"NaN"`, Infinity as `"Infinity"`, -Infinity as `"-Infinity"` (string representations per protobuf JSON spec).

#### Field Names: lowerCamelCase

All protobuf snake_case field names convert to lowerCamelCase in JSON:

| Protobuf | JSON |
|---|---|
| `time_unix_nano` | `timeUnixNano` |
| `severity_number` | `severityNumber` |
| `dropped_attributes_count` | `droppedAttributesCount` |
| `aggregation_temporality` | `aggregationTemporality` |
| `is_monotonic` | `isMonotonic` |
| `bucket_counts` | `bucketCounts` |
| `explicit_bounds` | `explicitBounds` |
| `start_time_unix_nano` | `startTimeUnixNano` |
| `observed_time_unix_nano` | `observedTimeUnixNano` |

#### Empty/Null Values

- Empty arrays (`[]`) are valid for `attributes`, `dataPoints`, etc.
- Unset protobuf fields are omitted from JSON (not included as `null`)
- An `AnyValue` with no fields set represents an empty/null value
- "Empty value, a numerical value of zero, an empty string, or an empty array are considered meaningful and MUST be stored"
- Attribute values of `null` are valid but discouraged in arrays; exporters MAY replace with defaults (0, false, "")

#### Unknown Fields

"OTLP/JSON receivers MUST ignore message fields with unknown names and MUST unmarshal the message as if the unknown field was not present." Use `#[serde(deny_unknown_fields)]` cautiously -- or better, do not use it at all with `serde`.

**Source**: [OTLP Specification - JSON Protobuf Encoding](https://opentelemetry.io/docs/specs/otlp/) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [opentelemetry-proto common.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto), [OTel Common Specification](https://opentelemetry.io/docs/specs/otel/common/), [Attribute Type Mapping](https://opentelemetry.io/docs/specs/otel/common/attribute-type-mapping/)

---

### Finding 6: Export Service Responses and HTTP Status Codes

**Evidence**: The response messages are minimal:

#### ExportLogsServiceResponse

```protobuf
message ExportLogsServiceResponse {
  ExportLogsPartialSuccess partial_success = 1;  // optional
}
message ExportLogsPartialSuccess {
  int64 rejected_log_records = 1;
  string error_message = 2;
}
```

JSON for full success (no rejections):
```json
{}
```

JSON for partial success:
```json
{
  "partialSuccess": {
    "rejectedLogRecords": "5",
    "errorMessage": "rate limit exceeded for some records"
  }
}
```

#### ExportMetricsServiceResponse

```protobuf
message ExportMetricsServiceResponse {
  ExportMetricsPartialSuccess partial_success = 1;  // optional
}
message ExportMetricsPartialSuccess {
  int64 rejected_data_points = 1;
  string error_message = 2;
}
```

JSON for full success:
```json
{}
```

JSON for partial success:
```json
{
  "partialSuccess": {
    "rejectedDataPoints": "3",
    "errorMessage": "quota exceeded"
  }
}
```

Note: `rejectedLogRecords` and `rejectedDataPoints` are `int64`, so they are string-encoded in JSON.

#### HTTP Status Codes

| Status | Meaning | Response Body | Client Action |
|---|---|---|---|
| 200 | Full success | `{}` (empty partialSuccess) | Done |
| 200 | Partial success | `{"partialSuccess": {...}}` | Do NOT retry |
| 400 | Bad Request | Error details | Do NOT retry (malformed) |
| 429 | Too Many Requests | May include Retry-After | Retry with backoff |
| 502 | Bad Gateway | Error details | Retry with backoff |
| 503 | Service Unavailable | Error details | Retry with backoff |
| 504 | Gateway Timeout | Error details | Retry with backoff |

Key rules:
- The server MUST leave `partialSuccess` unset (omitted from JSON) for full success
- The server MUST use the same Content-Type in the response as received in the request
- The client MUST NOT retry when receiving partial success

**Source**: [opentelemetry-proto logs_service.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/collector/logs/v1/logs_service.proto) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [opentelemetry-proto metrics_service.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/collector/metrics/v1/metrics_service.proto), [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/), [GitHub Collector Issue #9408](https://github.com/open-telemetry/opentelemetry-collector/issues/9408)

---

### Finding 7: Content-Type Headers

**Evidence**: The OTLP specification defines:

| Encoding | Request Content-Type | Response Content-Type |
|---|---|---|
| JSON Protobuf | `application/json` | `application/json` |
| Binary Protobuf | `application/x-protobuf` | `application/x-protobuf` |

Rules:
- The server MUST use the same Content-Type in the response as received in the request
- For a JSON-only receiver, validate that `Content-Type` is `application/json` and return 415 Unsupported Media Type for `application/x-protobuf` if you do not support it
- Alternatively, inspect the body: JSON always starts with `{`, protobuf does not -- but relying on Content-Type is the spec-compliant approach

**Source**: [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [OTEP-0122 OTLP/HTTP JSON](https://github.com/open-telemetry/oteps/blob/main/text/0122-otlp-http-json.md), [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)

---

## Rust Implementation Reference: Serde Type Mapping

Based on the findings above, here is the recommended serde type mapping for the hand-written structs approach (per ADR-031):

```
OTLP JSON Type          Rust serde Type             Notes
─────────────────────── ─────────────────────────── ──────────────────────────
timeUnixNano (string)   Option<String>              Parse to u64 after deser
intValue (string)       String                      Parse to i64 after deser
asInt (string)          String                      Parse to i64 after deser
count (string)          String                      Parse to u64 after deser
asDouble (number)       f64                         Direct JSON number
doubleValue (number)    f64                         Direct JSON number
severityNumber (int)    Option<u32>                 Enum as integer
aggregationTemp (int)   u32                         Enum as integer
traceId (hex string)    Option<String>              Validate hex, 32 chars
spanId (hex string)     Option<String>              Validate hex, 16 chars
bytesValue (base64)     String                      Decode base64 if needed
flags (number)          Option<u32>                 Bitmask
isMonotonic (bool)      Option<bool>                Direct JSON boolean
attributes (array)      Vec<KeyValue>               May be empty
```

For the `AnyValue` type, use an untagged enum in serde:

```
AnyValue variants → serde approach:
  Each variant is a JSON object with exactly one key.
  Use #[serde(rename_all = "camelCase")] on the struct fields,
  or manually specify #[serde(rename = "stringValue")] etc.
  The oneof is naturally modeled as a Rust enum with
  externally tagged representation where the tag is the field name.
```

---

## Source Analysis

| Source | Domain | Reputation | Type | Access Date | Cross-verified |
|---|---|---|---|---|---|
| OTLP Specification v1.10.0 | opentelemetry.io | High (1.0) | Official spec | 2026-03-23 | Y |
| opentelemetry-proto common.proto | github.com/open-telemetry | High (1.0) | Protobuf source | 2026-03-23 | Y |
| opentelemetry-proto logs.proto | github.com/open-telemetry | High (1.0) | Protobuf source | 2026-03-23 | Y |
| opentelemetry-proto metrics.proto | github.com/open-telemetry | High (1.0) | Protobuf source | 2026-03-23 | Y |
| opentelemetry-proto resource.proto | github.com/open-telemetry | High (1.0) | Protobuf source | 2026-03-23 | Y |
| OTel Logs Data Model | opentelemetry.io | High (1.0) | Official spec | 2026-03-23 | Y |
| OTel Metrics Data Model | opentelemetry.io | High (1.0) | Official spec | 2026-03-23 | Y |
| OTel Attribute Type Mapping | opentelemetry.io | High (1.0) | Official spec | 2026-03-23 | Y |

Reputation: High: 8 (100%) | Medium-high: 0 (0%) | Avg: 1.0

## Knowledge Gaps

### Gap 1: LogRecordFlags Bitmask Detailed Semantics

**Issue**: The `flags` field on LogRecord is defined as `fixed32` with only `LOG_RECORD_FLAGS_TRACE_FLAGS_MASK = 0x000000FF` documented. The upper 24 bits are reserved. The exact behavior when flags carry W3C trace context sampled bit vs other future flags is not fully documented beyond the mask constant.
**Attempted**: Reviewed logs.proto, OTLP spec, OTel logs data model.
**Recommendation**: For now, extract the low 8 bits as W3C trace flags if needed. Ignore upper bits. This is sufficient for the Norbert use case where tracing context on log records is informational only.

### Gap 2: Exact Claude Code Metric Types

**Issue**: While we know Claude Code emits metrics, the exact metric types (Sum vs Gauge vs Histogram) and specific metric names are not documented in the official Claude Code monitoring docs. The research on actual emissions (Finding 1 in the prior research) confirmed metrics exist but did not capture sample metric payloads.
**Attempted**: Web search for Claude Code OTLP metric names and types.
**Recommendation**: Capture a real metrics payload by running Claude Code with OTLP export enabled and logging the raw JSON to `/v1/metrics`. This will reveal the exact metric names, types, and temporality values.

## Conflicting Information

### Conflict 1: Attribute Value Types -- Spec vs Practice

**Position A**: The OTel specification states integer values SHOULD use `int_value` (intValue in JSON). -- Source: [Attribute Type Mapping](https://opentelemetry.io/docs/specs/otel/common/attribute-type-mapping/), Reputation: 1.0
**Position B**: Claude Code (and potentially other SDKs) sends integer-valued attributes as `stringValue` instead of `intValue`. -- Source: [Norbert Actual Emissions Research](docs/research/claude-code-otel-telemetry-actual-emissions.md), Reputation: project-internal observation
**Assessment**: Both are correct. The spec uses SHOULD (not MUST) for type mapping, making stringValue for numeric data spec-compliant. The receiver MUST handle both. Position A describes the recommendation; Position B describes real-world behavior. Design the parser to be tolerant.

## Recommendations for Further Research

1. **Capture real Claude Code metric payloads** to determine exact metric names, types (Sum/Gauge/Histogram), temporality, and attribute keys. Set up a logging proxy on `/v1/metrics` and run a Claude Code session.
2. **Test edge cases with empty payloads** -- send `{"resourceLogs": []}` and verify the receiver handles it gracefully. The spec does not explicitly forbid empty arrays at any level.
3. **Investigate gzip/compression** -- OTLP/HTTP supports `Content-Encoding: gzip`. If Claude Code sends compressed payloads, the receiver needs to decompress before JSON parsing. Check if this is configurable or automatic.

## Full Citations

[1] OpenTelemetry. "OTLP Specification 1.10.0". opentelemetry.io. 2025. https://opentelemetry.io/docs/specs/otlp/. Accessed 2026-03-23.
[2] OpenTelemetry. "common.proto - AnyValue, KeyValue, InstrumentationScope". github.com/open-telemetry. 2025. https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto. Accessed 2026-03-23.
[3] OpenTelemetry. "logs.proto - LogRecord, SeverityNumber". github.com/open-telemetry. 2025. https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/logs/v1/logs.proto. Accessed 2026-03-23.
[4] OpenTelemetry. "metrics.proto - Metric types, data points, enums". github.com/open-telemetry. 2025. https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/metrics/v1/metrics.proto. Accessed 2026-03-23.
[5] OpenTelemetry. "resource.proto - Resource". github.com/open-telemetry. 2025. https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/resource/v1/resource.proto. Accessed 2026-03-23.
[6] OpenTelemetry. "Logs Data Model". opentelemetry.io. 2025. https://opentelemetry.io/docs/specs/otel/logs/data-model/. Accessed 2026-03-23.
[7] OpenTelemetry. "Metrics Data Model". opentelemetry.io. 2025. https://opentelemetry.io/docs/specs/otel/metrics/data-model/. Accessed 2026-03-23.
[8] OpenTelemetry. "Mapping Arbitrary Data to OTLP AnyValue". opentelemetry.io. 2025. https://opentelemetry.io/docs/specs/otel/common/attribute-type-mapping/. Accessed 2026-03-23.

## Research Metadata

Duration: ~15 min | Examined: 12 | Cited: 8 | Cross-refs: 21 | Confidence: High 100%, Medium 0%, Low 0% | Output: docs/research/otlp-json-wire-format-specification.md
