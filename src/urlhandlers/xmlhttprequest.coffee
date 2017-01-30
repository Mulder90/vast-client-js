class XHRURLHandler
    @acceptedStatusCode: [
        200,
        201,
        202,
        204,
        206,
        304,
        1223
    ]

    @xhr: ->
        xhr = new window.XMLHttpRequest()
        if 'withCredentials' of xhr # check CORS support
            return xhr

    @supported: ->
        return !!@xhr()

    @get: (url, options, cb) ->
        if window.location.protocol == 'https:' && url.indexOf('http://') == 0
            return cb(new Error('XHRURLHandler: Cannot go from HTTPS to HTTP.'))

        try
            xhr = @xhr()
            xhr.open('GET', url)
            xhr.timeout = options.timeout or 0
            xhr.withCredentials = options.withCredentials or false
            xhr.overrideMimeType && xhr.overrideMimeType('text/xml');
            if options.retryOnFail?
                xhr.retryOnFail = options.retryOnFail
            else
                xhr.retryOnFail = true
            xhr.onreadystatechange = =>
                if xhr.readyState == 4
                    if xhr.status in @acceptedStatusCode
                        cb(null, xhr.responseXML)
                    else
                        if xhr.retryOnFail
                            opt =
                                timeout: options.timeout
                                withCredentials: false
                                retryOnFail: false
                            @get url, opt, cb
                        else
                            cb(null, xhr.responseXML)
            xhr.send()
        catch
            cb()

module.exports = XHRURLHandler
