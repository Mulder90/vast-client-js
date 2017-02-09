class VASTError
    constructor: (@message, @code) ->

class XMLParsingError extends VASTError
    constructor: ->
        super("XML parsing error.", 100)

class SchemaValidationError extends VASTError
    constructor: ->
        super("VAST schema validation error.", 101)

class VastVersionNotSupported extends VASTError
    constructor: ->
        super("VAST version of response not supported.", 102)

class TimeoutVastUri extends VASTError
    constructor: ->
        super("Timeout of VAST URI.", 301)

class WrapperLimitReached extends VASTError
    constructor: ->
        super("Wrapper limit reached.", 302)

class NoAdsResponseAfterWrapper extends VASTError
    constructor: ->
        super("No ads VAST response after one or more Wrappers.", 303)

class UndefinedError extends VASTError
    constructor: ->
        super("Undefined error.", 900)

module.exports =
    XMLParsingError: XMLParsingError
    SchemaValidationError: SchemaValidationError
    VastVersionNotSupported: VastVersionNotSupported
    TimeoutVastUri: TimeoutVastUri
    WrapperLimitReached: WrapperLimitReached
    NoAdsResponseAfterWrapper: NoAdsResponseAfterWrapper
    UndefinedError: UndefinedError