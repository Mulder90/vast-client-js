should = require 'should'
path = require 'path'
VASTParser = require '../src/parser'
VASTResponse = require '../src/response'

urlfor = (relpath) ->
    return 'file://' + path.resolve(path.dirname(module.filename), 'fixtures/' + relpath).replace(/\\/g, '/')

describe 'VASTParser', ->
    describe '#parse', ->
        @response = null
        _response = null
        @templateFilterCalls = []
        parser = null

        before (done) =>
            parser = new VASTParser()
            parser.addURLTemplateFilter (url) =>
              @templateFilterCalls.push url
              return url
            parser.parse urlfor('wrapper.xml'), (@response) =>
                _response = @response
                done()

        after () =>
            parser.clearUrlTemplateFilters()

        it 'should have 1 filter defined', =>
            parser.countURLTemplateFilters().should.equal 1

        it 'should have called URLtemplateFilter twice', =>
            @templateFilterCalls.should.have.length 2
            @templateFilterCalls.should.eql [urlfor('wrapper.xml'), urlfor('sample.xml')]

        it 'should have found 1 ad', =>
            @response.ads.should.have.length 1

        it 'should have returned a VAST response object', =>
            @response.should.be.an.instanceOf(VASTResponse)

        it 'should have merged top level error URLs', =>
            @response.errorURLTemplates.should.eql ["http://example.com/wrapper-error", "http://example.com/error"]

        it 'should have retrieved Ad id attribute', =>
            @response.ads[0].id.should.eql "41993e28-6f21-4e6b-bbd4-b7de053b0951"

        it 'should have retrieved Ad sequence attribute', =>
            @response.ads[0].sequence.should.eql "0"

        it 'should have retrieved AdSystem value', =>
            @response.ads[0].system.value.should.eql "AdServer"

        it 'should have retrieved AdSystem version attribute', =>
            @response.ads[0].system.version.should.eql "2.0"

        it 'should have retrieved AdTitle value', =>
            @response.ads[0].title.should.eql "Ad title"

        it 'should have retrieved Advertiser value', =>
            @response.ads[0].advertiser.should.eql "Advertiser name"

        it 'should have retrieved Description value', =>
            @response.ads[0].description.should.eql "Description text"

        it 'should have retrieved Pricing value', =>
            @response.ads[0].pricing.value.should.eql "1.09"

        it 'should have retrieved Pricing model attribute', =>
            @response.ads[0].pricing.model.should.eql "CPM"

        it 'should have retrieved Pricing currency attribute', =>
            @response.ads[0].pricing.currency.should.eql "USD"

        it 'should have merged wrapped ad error URLs', =>
            @response.ads[0].errorURLTemplates.should.eql ["http://example.com/wrapper-error", "http://example.com/error"]

        it 'should have merged impression URLs', =>
            @response.ads[0].impressionURLTemplates.should.eql ["http://example.com/wrapper-impression", "http://127.0.0.1:8080/second/wrapper_impression", "http://example.com/impression1", "http://example.com/impression2", "http://example.com/impression3"]

        it 'should have two creatives', =>
            @response.ads[0].creatives.should.have.length 2

        #Linear
        describe '#Linear', ->
            linear = null

            before (done) =>
                linear = _response.ads[0].creatives[0]
                done()

            it 'should have linear type', =>
                linear.type.should.equal "linear"

            it 'should have 1 media file', =>
                linear.mediaFiles.should.have.length 1

            it 'should have a duration of 90.123s', =>
                linear.duration.should.equal 90.123

            it 'should have parsed media file attributes', =>
                mediaFile = linear.mediaFiles[0]
                mediaFile.width.should.equal 512
                mediaFile.height.should.equal 288
                mediaFile.mimeType.should.equal "video/mp4"
                mediaFile.fileURL.should.equal "http://example.com/asset.mp4"

            it 'should have 8 tracking events', =>
                linear.trackingEvents.should.have.keys 'start', 'close', 'midpoint', 'complete', 'firstQuartile', 'thirdQuartile', 'progress-30', 'progress-60%'

            it 'should have 2 urls for start event', =>
                linear.trackingEvents['start'].should.eql ['http://example.com/start', 'http://example.com/wrapper-start']

            it 'should have 2 urls for complete event', =>
                linear.trackingEvents['complete'].should.eql ['http://example.com/complete', 'http://example.com/wrapper-complete']

            it 'should have 2 urls for clicktracking', =>
                linear.videoClickTrackingURLTemplates.should.eql ['http://example.com/clicktracking', 'http://example.com/wrapper-clicktracking']

            it 'should have 1 url for customclick', =>
                linear.videoCustomClickURLTemplates.should.eql ['http://example.com/customclick']

            it 'should have 2 urls for progress-30 event VAST 3.0', =>
                linear.trackingEvents['progress-30'].should.eql ['http://example.com/progress-30sec', 'http://example.com/wrapper-progress-30sec']

            it 'should have 2 urls for progress-60% event VAST 3.0', =>
                linear.trackingEvents['progress-60%'].should.eql ['http://example.com/progress-60%', 'http://example.com/wrapper-progress-60%']

        #Companions
        describe '#Companions', ->
            companions = null

            before (done) =>
                companions = _response.ads[0].creatives[1]
                done()

            it 'should have companion type', =>
                companions.type.should.equal "companion"

            it 'should have 3 variations', =>
                companions.variations.should.have.length 3

            #Companion
            describe '#Companion', ->
                companion = null

                describe 'as image/jpeg', ->
                    before (done) =>
                        companion = companions.variations[0]
                        done()

                    it 'should have parsed size and type attributes', =>
                        companion.width.should.equal '300'
                        companion.height.should.equal '60'
                        companion.type.should.equal 'image/jpeg'

                    it 'should have 1 tracking event', =>
                        companion.trackingEvents.should.have.keys 'creativeView'

                    it 'should have 1 url for creativeView event', =>
                        companion.trackingEvents['creativeView'].should.eql ['http://example.com/creativeview']

                    it 'should have 1 companion clickthrough url', =>
                        companion.companionClickThroughURLTemplate.should.equal  'http://example.com/companion-clickthrough'

                    it 'should have 1 companion clicktracking url', =>
                        companion.companionClickTrackingURLTemplate.should.equal  'http://example.com/companion-clicktracking'

                describe 'as IFrameResource', ->
                  before (done) =>
                      companion = companions.variations[1]
                      done()

                  it 'should have parsed size and type attributes', =>
                      companion.width.should.equal '300'
                      companion.height.should.equal '60'
                      companion.type.should.equal 0

                  it 'does not have tracking events', =>
                    companion.trackingEvents.should.be.empty

                  it 'has the #iframeResource set', ->
                    companion.iframeResource.should.equal 'http://www.example.com/example.php'

                describe 'as text/html', ->
                    before (done) =>
                        companion = companions.variations[2]
                        done()

                    it 'should have parsed size and type attributes', =>
                        companion.width.should.equal '300'
                        companion.height.should.equal '60'
                        companion.type.should.equal 'text/html'

                    it 'should have 1 tracking event', =>
                        companion.trackingEvents.should.be.empty

                    it 'should have 1 companion clickthrough url', =>
                        companion.companionClickThroughURLTemplate.should.equal  'http://www.example.com'

                    it 'has #htmlResource available', ->
                      companion.htmlResource.should.equal "<a href=\"http://www.example.com\" target=\"_blank\">Some call to action HTML!</a>"

        describe '#VAST', ->
            @response = null
            parser = null

            before (done) =>
                parser = new VASTParser()
                parser.parse urlfor('vpaid.xml'), (@response) =>
                    done()

            it 'should have apiFramework set', =>
                @response.ads[0].creatives[0].mediaFiles[0].apiFramework.should.be.equal "VPAID"


    describe '#track', ->
        parser = null
        errorCallbackCalled = 0
        errorCode = null
        errorCallback = (ec) ->
            errorCallbackCalled++
            errorCode = ec

        beforeEach =>
            parser = new VASTParser()
            parser.vent.removeAllListeners()
            errorCallbackCalled = 0

        #No ads VAST response after one wrapper
        it 'emits an VAST-error on empty vast directly', (done) ->
            parser.on 'VAST-error', errorCallback
            parser.parse urlfor('empty.xml'), =>
                errorCallbackCalled.should.equal 1
                errorCode.ERRORCODE.should.eql 303
                done()

        # VAST response with Ad but no Creative
        it 'emits a VAST-error on response with no Creative', (done) ->
            parser.on 'VAST-error', errorCallback
            parser.parse urlfor('empty-no-creative.xml'), =>
                errorCallbackCalled.should.equal 1
                errorCode.ERRORCODE.should.eql 303
                done()

        #No ads VAST response after more than one wrapper
        # Two events should be emits :
        # - 1 for the empty vast file
        # - 1 for no ad response on the wrapper
        it 'emits 2 VAST-error events on empty vast after one wrapper', (done) ->
            parser.on 'VAST-error', errorCallback
            parser.parse urlfor('wrapper-empty.xml'), =>
                # errorCallbackCalled.should.equal 2
                # errorCode.ERRORCODE.should.eql 303
                done()

    describe '#legacy', ->
        parser = null

        beforeEach =>
            parser = new VASTParser()
            parser.vent.removeAllListeners()

        it 'correctly loads a wrapped ad, even with the VASTAdTagURL-Tag', (done) ->
            parser.parse urlfor('wrapper-legacy.xml'), (response) =>
                it 'should have found 1 ad', =>
                    response.ads.should.have.length 1

                it 'should have returned a VAST response object', =>
                    response.should.be.an.instanceOf(VASTResponse)

                # we just want to make sure that the sample.xml was loaded correctly
                linear = response.ads[0].creatives[0]
                it 'should have parsed media file attributes', =>
                    mediaFile = linear.mediaFiles[0]
                    mediaFile.width.should.equal 512
                    mediaFile.height.should.equal 288
                    mediaFile.mimeType.should.equal "video/mp4"
                    mediaFile.fileURL.should.equal "http://example.com/asset.mp4"

                done()
