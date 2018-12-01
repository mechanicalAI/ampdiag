/*              The MIT License (MIT)

Copyright (c) 2018 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.                       */

//****************************************
//WHAT:  Diganostic overlay plugin for Azure Media Player
//WHO:   willzhan@microsoft.com
//WHEN:  2018
//WHERE: plugin gallery http://amp.azure.net/libs/amp/latest/docs/PLUGINS.html 
//****************************************

(function (mediaPlayer) {
    "use strict";

    mediaPlayer.plugin('diagnoverlay', function (options) {

        //****************************************
        // INPUTS & VARIABLES
        //****************************************

        //plugin level variables
        var stopEventUpdate = false;   //indicate whether to stop event update in updateEvent such as when error occurs
        var events = [];               //holding all events
        var EVENTS_TO_DISPLAY = 650;
        var timeupdateDisplay = "",
            streamDisplay = "",
            audioBufferDataDisplay = "",
            videoBufferDataDisplay = "",
            framerate = "";
        var player = this,
            overlayCssClass = "amp-diagnoverlay",
            tableCssClass = "overlay-table",
            titleCssClass = "overlay-table-title",
            selectCssClass = "overlay-select",
            wrapperCssClass = "overlay-select-wrapper";


        //input parameters
        var title = !!options && !!options.title ? options.title : "",
            opacity = !!options && !!options.opacity ? options.opacity : 0.6,
            bgColor = !!options && !!options.bgColor ? options.bgColor : "Black",
            x = !!options && !!options.x ? options.x : "left",
            y = !!options && !!options.y ? options.y : "top";



        //****************************************
        // PLUGIN
        //****************************************

        var Component = mediaPlayer.getComponent("Component");

        //create overlay
        mediaPlayer.Overlay = amp.extend(Component, {
            init: function (player, options) {
                Component.call(this, player, options);
            }
        });

        mediaPlayer.Overlay.prototype.createEl = function () {
            var el = Component.prototype.createEl.call(this, "div", { className: overlayCssClass });
            el.id = "outerdiv";
            el.style.opacity = opacity;
            el.style.backgroundColor = bgColor;
            //el.style.borderRadius = '14px';       // standard
            //el.style.MozBorderRadius = '15px';    // Mozilla
            //el.style.WebkitBorderRadius = '15px'; // WebKit
            el.onload = function () {
                updateOverlay();
            };

            this.container = el;  //and this.div, this.eventdiv

            addElementsToOverlay(this);

            return el;
        };

        //add HTML elements into the overlay
        function addElementsToOverlay(overlay) {
            //image
            if (!!options && !!options.image && options.image.length > 0) {
                var thumbnail = document.createElement('img');
                thumbnail.id = "thumbnail";
                thumbnail.style.visibility = "visible";
                thumbnail.src = options.image;
                thumbnail.style.width = "30px";
                overlay.container.appendChild(thumbnail);
            }

            //top div
            var div = videojs.createEl("div", {});
            div.id = "innerdiv";
            div.onload = function () {
                updateOverlay();
            };
            overlay.container.appendChild(div);

            //var label = document.createElement('label')
            //label.htmlFor = "chkevent";
            //label.appendChild(document.createTextNode("show events or errors"));
            //overlay.container.appendChild(checkbox);
            //overlay.container.appendChild(label);

            //select
            var select = document.createElement("select");
            select.name = "select";
            select.id = "select";
            select.className = selectCssClass;
            var dropdowns = ["More ...",                                 //options variable is taken
                "Events, errors, downloads",
                "Browser, AMP, screen",
                "Renditions, streams, tracks",
                "DRM",
                "MPD, ISOBMFF boxes",
                "Live archive"];

            var dropdown;   //the option element
            for (var i = 0; i < dropdowns.length; i++) {
                dropdown = document.createElement("option");
                dropdown.innerHTML = dropdowns[i];
                dropdown.value = dropdowns[i];
                select.appendChild(dropdown);
            }

            select.onchange = function () {
                //initial visibility status
                stopEventUpdate = true;
                player.overlay.pre.textContent = "";
                player.overlay.pre.style.display = "none";
                player.overlay.eventdiv.style.visibility = "visible";
                player.overlay.eventdiv.style.display = "block";
                player.overlay.eventdiv.innerHTML = "";

                switch (select.options[select.selectedIndex].value) {
                    case dropdowns[0]:
                        //hide eventdiv
                        player.overlay.eventdiv.style.visibility = "hidden";
                        player.overlay.eventdiv.style.display = "none";
                        break;
                    case dropdowns[1]:
                        //start displaying events
                        stopEventUpdate = false;
                        updateEvent(EVENTS_TO_DISPLAY);
                        break;
                    case dropdowns[2]:
                        //display browser and AMP info
                        BrowserUtils.getBrowserAMPInfo();
                        break;
                    case dropdowns[3]:
                        //display video renditions
                        AMPUtils.displayRenditions();
                        AMPUtils.displayAudioStreams();
                        AMPUtils.displayTextTracks();
                        //highlight the currentPlaybackBitrate(), without waiting for amp.eventName.playbackbitratechanged
                        if (!!player.currentPlaybackBitrate()) {
                            AMPUtils.updateCurrentPlaybackBitrate(player.currentPlaybackBitrate());
                        }
                        break;
                    case dropdowns[4]:
                        //display DRM info
                        getProtectionInfo();
                        break;
                    case dropdowns[5]:
                        DashUtils.getMPD();
                        break;
                    case dropdowns[6]:
                        DashUtils.getLiveArchiveInfo();
                        break;
                    default:
                        break;
                }
            }; //onchange

            //overlay-select-wrapper <div> containing select element for better styling select
            var wrapperdiv = videojs.createEl("div", {});
            wrapperdiv.className = wrapperCssClass;
            wrapperdiv.appendChild(select);
            overlay.container.appendChild(wrapperdiv);

            //event div
            var eventdiv = videojs.createEl("div", {});
            eventdiv.id = "eventdiv";
            eventdiv.style.visibility = "hidden";
            eventdiv.style.display = "none";
            eventdiv.onload = function () {
                updateOverlay();
            };
            eventdiv.onclick = function () {
                BrowserUtils.copyToClipboard(eventdiv.textContent);
            };
            overlay.container.appendChild(eventdiv);

            //pre
            var pre = document.createElement("pre");
            pre.textContent = "";
            pre.style.display = "none";
            pre.onclick = function () {
                BrowserUtils.copyToClipboard(pre.textContent);
            };
            overlay.container.appendChild(pre);

            //expose div and eventdiv
            overlay.div = div;
            overlay.eventdiv = eventdiv;
            overlay.pre = pre;
            overlay.select = select;
        }

        player.ready(function () {  //main function
            var overlay = new mediaPlayer.Overlay(player);
            player.overlay = player.addChild(overlay);

            registerOverlayEvents();

            events.push("player.ready event");
        });



        //****************************************
        //  POSITION & SIZE
        //****************************************


        //function showOverlay() {
        //    updateOverlay();

        //    player.overlay.removeClass("vjs-user-inactive");
        //    player.overlay.addClass("vjs-user-active");
        //}

        //function hideOverlay() {
        //    player.overlay.removeClass("vjs-user-active");
        //    player.overlay.removeClass("vjs-user-inactive");
        //    player.overlay.addClass("vjs-user-hide");
        //}

        function getX(innerdiv, x) {
            var videoElement = player.el();
            var position;
            switch (x) {
                case "center":
                    position = (videoElement.clientWidth / 2) - (innerdiv.parentElement.clientWidth / 2);
                    break;
                case "right":
                    position = videoElement.clientWidth - innerdiv.parentElement.clientWidth - 1;
                    break;
                default:
                    position = 0;
                    break;
            }

            return position;
        }

        function getY(innerdiv, y) {
            var position;
            var videoElement = player.el(),
                controlBarHeight = player.controlBar.el().clientHeight || 31,
                progressControlHeight = player.controlBar.progressControl.el().clientHeight || 12;

            switch (y) {
                case "middle":
                    position = (videoElement.clientHeight / 2) - (innerdiv.parentElement.clientHeight / 2) - (controlBarHeight / 2) - (progressControlHeight / 2);
                    break;
                case "bottom":
                    position = videoElement.clientHeight - innerdiv.parentElement.clientHeight - controlBarHeight - progressControlHeight;
                    break;
                default:
                    position = 0;
                    break;
            }

            return position;
        }

        function updateOverlayMaxSize(innerdiv) {
            // Update image max size according video size
            var videoElement = player.el();
            if ((videoElement.clientHeight < innerdiv.parentElement.clientHeight) || (videoElement.clientWidth < innerdiv.parentElement.clientWidth)) {
                innerdiv.style.maxHeight = videoElement.clientHeight + 'px';
                innerdiv.style.maxWidth = videoElement.clientWidth + 'px';
            } else {
                innerdiv.style.maxHeight = '100%';
                innerdiv.style.maxWidth = '100%';
            }
        }

        function updateOverlayPosition(outerdiv, innerdiv) {
            // Update DIV based on image values (now calculated because it was added to the DOM)
            outerdiv.style.left = getX(innerdiv, x) + 'px';
            outerdiv.style.top = getY(innerdiv, y) + 'px';
        }



        //****************************************
        // UPDATE CONTENT
        //****************************************


        function updateOverlay() {
            //update position when the video returns from fullscreen
            player.overlay.container.style.left = '0';
            player.overlay.container.style.top = '0';

            //check framerate plugin
            var timecode;
            if (!!amp.eventName.framerateready) {
                timecode = "- current timecode: " + player.toTimecode(player.toPresentationTime(player.currentTime()));
            } else {
                timecode = "- current time: " + player.currentTime();
            }
            var audioStream = getCurrentAudioStream(player);

            timeupdateDisplay = timecode +
                "\n- current media time: " + (!!player.currentMediaTime() ? player.currentMediaTime().toFixed(3) : "") +
                "\n- current absolute time: " + (!!player.currentAbsoluteTime() ? player.currentAbsoluteTime().toFixed(3) : "") +
                "\n- current playback bitrate: " + addCommas(player.currentPlaybackBitrate()) +
                "\n- current download bitrate: " + addCommas(player.currentDownloadBitrate()) +
                "\n- current audio name: " + (!!audioStream ? audioStream.name : "") +
                "\n- current audio codec: " + (!!audioStream ? audioStream.codec : "") +
                "\n- current audio bitrate: " + (!!audioStream ? addCommas(audioStream.bitrate) : "") +
                "\n- current audio language: " + (!!audioStream ? audioStream.language : "") +
                "\n- current video track size: " + player.videoWidth() + " x " + player.videoHeight();
            updateContent();

            updateOverlayMaxSize(player.overlay.div);
            updateOverlayPosition(player.overlay.container, player.overlay.div);
        }

        function updateContent() {
            var displayTitle = !!title && title.length > 0 ? title + "\n" : "";
            player.overlay.div.innerText = displayTitle + timeupdateDisplay + streamDisplay + audioBufferDataDisplay + videoBufferDataDisplay + framerate;
        }

        //count: number of recent events to display
        function updateEvent(count) {
            //var clock = getWallClock();
            var length = events.length;
            if (!stopEventUpdate && length > 0) {
                var msg = "";
                count = Math.min(count, length)
                for (var i = length - 1; i >= length - count; i--) {
                    if (i == length - 1) {
                        msg += "- " + events[i];
                    } else {
                        msg += "\n- " + events[i];
                    }
                }

                player.overlay.eventdiv.innerText = msg;
            }

            //in case events array gets too large
            if (events.length > 15000) {
                events = [];
            }
        }

        function getCurrentAudioStream(player) {
            var audioStreamList = player.currentAudioStreamList();
            var audioStream = null;
            if (audioStreamList) {
                for (var i = 0; i < audioStreamList.streams.length; i++) {
                    if (audioStreamList.streams[i].enabled) {
                        audioStream = audioStreamList.streams[i];
                        break;
                    }
                }
            }

            return audioStream;
        }



        //****************************************
        //AMPUtils
        //****************************************
        function AMPUtils() { };

        //get smooth URL
        function getSmoothUrl() {
            var url = player.currentSrc();
            var manifestExtension = ".ism/manifest";
            url = url.substr(0, url.toLowerCase().lastIndexOf(manifestExtension) + manifestExtension.length);
            return url;
        }

        //accommodate both v2 and v3 URL formats
        function getDashUrl() {
            var url = player.currentSrc();;
            if (url.lastIndexOf("manifest(format=mpd-time-") < 0) {
                url = getSmoothUrl() + "(format=mpd-time-csf)";
            }
            return url;
        }

        function getHlsUrl() {
            var url = player.currentSrc();
            if (url.lastIndexOf("manifest(format=mpd-time-") < 0) {
                url = getSmoothUrl() + "(format=m3u8-aapl)";
            } else {
                url = getSmoothUrl() + "(format=m3u8-aapl,encryption=cbcs-aapl)";
            }
            return url;
        }

        AMPUtils.getRenditions = function (amPlayer) {
            var renditions = [];

            if (amPlayer.currentVideoStreamList() != undefined) {
                var videoStreamList = amPlayer.currentVideoStreamList();
                var videoTracks;

                for (var i = 0; i < videoStreamList.streams.length; i++) {
                    videoTracks = videoStreamList.streams[i].tracks;
                    if (videoTracks != undefined) {
                        for (var j = 0; j < videoTracks.length; j++)
                            renditions.push({
                                bitrate: videoTracks[j].bitrate,
                                width: videoTracks[j].width,
                                height: videoTracks[j].height,
                                selectable: videoTracks[j].selectable
                            });
                    }
                }
            }

            return renditions;
        };

        //display video rendition array as a table in player.overlay.eventdiv
        AMPUtils.displayRenditions = function () {
            var ID = "rendition_table";

            // if a table with the same id exists, clean up the data first
            var tbl = document.getElementById(ID);
            if (!!tbl) {
                while (tbl.rows.length > 0) {
                    tbl.deleteRow(0);
                }
            } else {
                tbl = document.createElement("table");
                tbl.id = ID;
            }
            tbl.className = tableCssClass;

            var renditions = AMPUtils.getRenditions(player);

            var tblBody = document.createElement("tbody");
            var row, cell, cellText;
            var headers = ["Index", "Bitrate", "Width", "Height", "Selectable", "Restrict Bitrate"];
            var titles = ["", "VIDEO RENDITIONS:"];

            //space and title on top of table          
            for (var i = 0; i < titles.length; i++) {
                row = document.createElement("tr");
                cell = document.createElement("td");
                cell.colSpan = headers.length;
                cell.className = titleCssClass;
                cellText = document.createTextNode(titles[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
                tblBody.appendChild(row);
            }

            //create column headers row
            row = document.createElement("tr");
            for (var i = 0; i < headers.length; i++) {
                cell = document.createElement("th");
                cellText = document.createTextNode(headers[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            tblBody.appendChild(row);

            //create data rows
            if (!!renditions && renditions.length > 0) {
                var columns;
                for (var i = 0; i < renditions.length; i++) {
                    row = document.createElement("tr");
                    row.id = "rendition_" + i;   //used to update background of currentPlaybackBitrate

                    columns = [i,
                        addCommas(renditions[i].bitrate),
                        renditions[i].width,
                        renditions[i].height,
                        renditions[i].selectable,
                    ];

                    for (var j = 0; j < columns.length; j++) {
                        cell = document.createElement("td");
                        cellText = document.createTextNode(columns[j]);
                        cell.appendChild(cellText);
                        row.appendChild(cell);
                    }

                    //column: select (force-select a bitrate)
                    cell = document.createElement("td");
                    cellText = document.createElement("a");
                    cellText.onclick = (function (i) { return function () { AMPUtils.selectRendition(i); } })(i);    //IIFE http://benalman.com/news/2010/11/immediately-invoked-function-expression/
                    cellText.innerHTML = "select";
                    cell.appendChild(cellText);
                    row.appendChild(cell);

                    tblBody.appendChild(row);
                }
            }

            //create last row showing "Auto-adapt" link
            row = document.createElement("tr");

            //column: text
            cell = document.createElement("td");
            cell.colSpan = 5;
            cellText = document.createTextNode("You can either force-select a bitrate or let it auto-adapt");
            cell.appendChild(cellText);
            row.appendChild(cell);

            //column: Auto-adapt link
            cell = document.createElement("td");
            cellText = document.createElement("a");
            cellText.onclick = function () { AMPUtils.selectRendition(-1); };
            cellText.innerHTML = "Auto-adapt";
            cell.appendChild(cellText);
            row.appendChild(cell);

            tblBody.appendChild(row);

            // append the <tbody> inside the <table>
            tbl.appendChild(tblBody);

            player.overlay.eventdiv.appendChild(tbl);
        };

        //display audio stream array as a table in player.overlay.eventdiv
        AMPUtils.displayAudioStreams = function () {
            //var ID = "audio_streams_table";
            var ID = "rendition_table";

            // if a table with the same id exists, clean up the data first
            var tbl = document.getElementById(ID);
            //if (!!tbl) {
            //    while (tbl.rows.length > 0) {
            //        tbl.deleteRow(0);
            //    }
            //} else {
            //    tbl = document.createElement("table");
            //    tbl.id = ID;
            //}
            tbl.className = tableCssClass;

            var tblBody = document.createElement("tbody");
            var row, cell, cellText;
            var headers = ["Index", "Bitrate", "Enabled", "Language", "Name", "Codec"];
            var titles = ["", "AUDIO STREAMS:"];
            var i;

            //space and title on top of table          
            for (i = 0; i < titles.length; i++) {
                row = document.createElement("tr");
                cell = document.createElement("td");
                cell.colSpan = headers.length;
                cell.className = titleCssClass;
                cellText = document.createTextNode(titles[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
                tblBody.appendChild(row);
            }

            //create column headers row        
            row = document.createElement("tr");
            for (i = 0; i < headers.length; i++) {
                cell = document.createElement("th");
                cellText = document.createTextNode(headers[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            tblBody.appendChild(row);

            if (!!player.currentAudioStreamList()) {
                var columns;
                var streams = player.currentAudioStreamList().streams;
                if (!!streams) {

                    //create data rows
                    for (i = 0; i < streams.length; i++) {
                        row = document.createElement("tr");
                        row.id = "audiostream_" + i;

                        columns = [i,
                            addCommas(streams[i].bitrate),
                            streams[i].enabled,
                            streams[i].language,
                            streams[i].name,
                            streams[i].codec
                        ];

                        for (var j = 0; j < columns.length; j++) {
                            cell = document.createElement("td");
                            cellText = document.createTextNode(columns[j]);
                            cell.appendChild(cellText);
                            row.appendChild(cell);
                        }

                        tblBody.appendChild(row);
                    }
                }
            }

            // append the <tbody> inside the <table>
            tbl.appendChild(tblBody);

            player.overlay.eventdiv.appendChild(tbl);
        };

        //display text tracks
        AMPUtils.displayTextTracks = function () {
            var ID = "rendition_table";
            var tbl = document.getElementById(ID);
            tbl.className = tableCssClass;

            var tblBody = document.createElement("tbody");
            var row, cell, cellText;
            var headers = ["Index", "Language", "Kind", "Mode", "Label", "Source"];
            var titles = ["", "TEXT TRACKS:"];
            var i;

            //space and title on top of table          
            for (i = 0; i < titles.length; i++) {
                row = document.createElement("tr");
                cell = document.createElement("td");
                cell.colSpan = headers.length;
                cell.className = titleCssClass;
                cellText = document.createTextNode(titles[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
                tblBody.appendChild(row);
            }

            //create column headers row        
            row = document.createElement("tr");
            for (i = 0; i < headers.length; i++) {
                cell = document.createElement("th");
                cellText = document.createTextNode(headers[i]);
                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            tblBody.appendChild(row);

            if (!!player.textTracks_) {
                var columns;
                var tracks = player.textTracks_;
                if (!!tracks && tracks.length > 0) {

                    //create data rows
                    for (i = 0; i < tracks.length; i++) {
                        row = document.createElement("tr");
                        row.id = "texttrack_" + i;

                        columns = [i,
                            tracks[i].language,
                            tracks[i].kind,
                            tracks[i].mode,
                            tracks[i].label,
                            "..." + tracks[i].src.substr(tracks[i].src.length - 25, 25)
                        ];

                        for (var j = 0; j < columns.length; j++) {
                            cell = document.createElement("td");
                            cellText = document.createTextNode(columns[j]);
                            cell.appendChild(cellText);
                            row.appendChild(cell);
                        }

                        tblBody.appendChild(row);
                    }
                }
            }

            // append the <tbody> inside the <table>
            tbl.appendChild(tblBody);

            player.overlay.eventdiv.appendChild(tbl);
        };


        //create <table> with given matrix and id
        AMPUtils.createTable = function (matrix, id) {
            // if a table with the same id exists, clean up the data first
            var tbl = document.getElementById(id);
            if (!!tbl) {
                while (tbl.rows.length > 0) {
                    tbl.deleteRow(0);
                }
            } else {
                tbl = document.createElement("table");
            }

            var tblBody = document.createElement("tbody");
            var row, cell, cellText;

            // cells creation
            for (var i = 0; i < matrix.length; i++) {
                row = document.createElement("tr");

                for (var j = 0; j < matrix[i].length; j++) {
                    cell = document.createElement("td");
                    cellText = document.createTextNode(matrix[i][j]);
                    cell.appendChild(cellText);
                    row.appendChild(cell);
                }

                tblBody.appendChild(row);
            }

            // append the <tbody> inside the <table>
            tbl.appendChild(tblBody);

            return tbl;
        };


        //index = -1: auto-adapt, index >= 0: restrict to specific bitrate
        AMPUtils.selectRendition = function (index) {
            var videoStreamList = player.currentVideoStreamList();

            if (!!videoStreamList) {
                if (!!videoStreamList.streams) {
                    videoStreamList.streams[0].selectTrackByIndex(index);
                }
            }
        };

        //change background color of current playback videotrack in the <table>
        //this method is called in the following events: amp.eventName.playbackbitratechanged, function displayInfo(3)
        AMPUtils.updateCurrentPlaybackBitrate = function (bitrate) {
            var renditions = AMPUtils.getRenditions(player);
            var selectedRow;
            if (!!renditions) {
                for (var i = 0; i < renditions.length; i++) {
                    selectedRow = document.getElementById("rendition_" + i);   //may be undefined if not shown
                    if (!!selectedRow) {
                        if (renditions[i].bitrate == bitrate) {
                            selectedRow.style.background = "green";
                        } else {
                            selectedRow.style.background = "none";
                        }
                    }
                }
            }
        };


        //****************************************
        // BROWSER UTILS
        //****************************************

        function BrowserUtils() { }

        //Utility function for making XMLHttpRequest
        //httpMethod: GET, or POST
        //responseType: arraybuffer, "" (default: text), blob, stream
        //msCaching: auto, enabled, disabled
        BrowserUtils.xhrRequest = function (url, httpMethod, responseType, msCaching, context, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open(httpMethod, url);
            xhr.responseType = responseType;
            xhr.msCaching = msCaching;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        if (context == "useResponseXML") {        //MPD request
                            callback(xhr.responseXML, context);
                        }
                        else {                                    //fragment/LA request
                            callback(xhr.response, context);
                        }
                    } else {
                        console.log("XHR: failed. URL = " + url + ". Status = " + xhr.status + ". " + xhr.statusText);
                        callback(null, context);
                    }
                }
            };
            xhr.send();
            console.log("XHR: method=" + httpMethod + ", ResponseType=" + responseType + ", URL=" + url);

            return xhr;
        };


        BrowserUtils.getBrowserAMPInfo = function () {
            var autoplay;
            if (typeof player.autoplay == "function") {
                autoplay = player.autoplay();
            } else {
                autoplay = "undefined";
            }

            var protection;
            if (!!player.currentProtectionInfo()) {
                protection = player.currentProtectionInfo().type;
            } else {
                protection = "unprotected";
            }

            var msg = BrowserUtils.getBrowserPlugins() +
                BrowserUtils.getBrowserMimeTypes() +
                "\n- MSE: " + BrowserUtils.isMSESupported() +
                "\n- EME: " + BrowserUtils.getEMESupport() +
                "\n- user agent: " + BrowserUtils.wrapText(navigator.userAgent) +
                "\n- screen resolution: " + window.screen.width + " x " + window.screen.height +
                "\n- screen available resolution: " + window.screen.availWidth + " x " + window.screen.availHeight +
                "\n- screen color depth: " + window.screen.colorDepth +
                "\n- screen pixel depth: " + window.screen.pixelDepth +
                "\n- device pixel ratio: " + window.devicePixelRatio +
                "\n- cookie enabled: " + navigator.cookieEnabled +
                "\n- browser language: " + navigator.language +
                "\n- Support HEVC: " + BrowserUtils.supportCodec("video/mp4", "hev1") +
                //"\n- Support DASH: " + MediaSource.isTypeSupported("application/dash+xml") +
                //"\n- Support HLS: "  + MediaSource.isTypeSupported("application/vnd.apple.mpegurl") +
                "\n- AMP version: " + player.getAmpVersion() +
                "\n- player size: " + player.width() + " x " + player.height() +
                "\n- autoplay: " + autoplay +
                "\n- duration (sec): " + player.duration().toFixed(2) +
                "\n- current video streams: " + player.currentVideoStreamList().streams[0].codec + " (# of video streams = " + player.currentVideoStreamList().streams.length + ")" +
                "\n- current audio streams: " + player.currentAudioStreamList().streams[0].codec + " (# of audio streams = " + player.currentAudioStreamList().streams.length + ")" +
                "\n- current type: " + player.currentType() +
                "\n- current tech: " + player.currentTechName() +
                "\n- current protection type: " + protection +
                "\n- current heuristic profile: " + player.currentHeuristicProfile() +
                "\n- current source: " + BrowserUtils.wrapText(player.currentSrc());

            player.overlay.eventdiv.innerText = msg;
        };

        //wrap text longer than certain length
        BrowserUtils.wrapText = function (text) {
            var wrap = "";
            var maxLength = 58;
            if (text.length > maxLength) {
                var numSegments = Math.ceil(text.length / maxLength);
                for (var i = 0; i < numSegments; i++) {
                    if (i == 0) {
                        wrap += text.substr(i * maxLength, maxLength);
                    } else {
                        wrap += "\n   " + text.substr(i * maxLength, maxLength);
                    }
                }
            } else {
                wrap = text;
            }
            return wrap;
        };

        //get browser plugins (into ordered list)
        BrowserUtils.getBrowserPlugins = function () {
            var plugins = "\n- browser plugins:";
            var plugin;
            if (!!navigator.plugins && navigator.plugins.length > 0) {
                for (var i = 0; i < navigator.plugins.length; i++) {
                    plugin = navigator.plugins[i].name;
                    if (!!navigator.plugins[i].description) {
                        plugin += " (" + navigator.plugins[i].description + ")";
                    }
                    plugins += "\n   -- " + BrowserUtils.wrapText(plugin);
                }
            } else {
                plugins += " None detected."
            }
            return plugins;
        };

        BrowserUtils.getBrowserMimeTypes = function () {
            var types = "\n- browser MIME types: ";
            if (!!navigator.mimeTypes && navigator.mimeTypes.length > 0) {
                var mimes = navigator.mimeTypes;
                for (var i = 0; i < mimes.length; i++) {
                    types += "\n   -- " + mimes[i].type;
                    if (!!mimes[i].description) {
                        types += " (" + mimes[i].description + ")";
                    }
                }
            }
            else {
                types += "None detected";
            }

            return types;
        };


        BrowserUtils.isMSESupported = function () {
            var supported = false;
            if (typeof MediaSource == "function") {
                var mse = new MediaSource();
                if (mse) { supported = true; }
            }
            return supported;
        };

        BrowserUtils.getEMESupport = function () {
            var eme = "";
            window.MediaKeys = window.MediaKeys || window.MSMediaKeys || window.WebKitMediaKeys;
            if (window.MediaKeys && window.MediaKeys.isTypeSupported) {
                //HTMLMediaElement.canPlayType(); navigator.requestMediaKeySystemAccess();
                if (window.MediaKeys.isTypeSupported(ContentProtection.MediaKey_PlayReady) || window.MediaKeys.isTypeSupported(null, ContentProtection.MediaKey_PlayReady)) {
                    eme += ContentProtection.MediaKey_PlayReady + "; ";
                }
                if (window.MediaKeys.isTypeSupported(ContentProtection.MediaKey_Widevine) || window.MediaKeys.isTypeSupported(null, ContentProtection.MediaKey_Widevine)) {
                    eme += ContentProtection.MediaKey_Widevine + "; ";
                }
                if (window.MediaKeys.isTypeSupported(ContentProtection.MediaKey_ClearKey) || window.MediaKeys.isTypeSupported(null, ContentProtection.MediaKey_ClearKey)) {
                    eme += ContentProtection.MediaKey_ClearKey + "; ";
                }
                if (window.MediaKeys.isTypeSupported(ContentProtection.MediaKey_Access) || window.MediaKeys.isTypeSupported(null, ContentProtection.MediaKey_Access)) {
                    eme += ContentProtection.MediaKey_Access + "; ";
                }
                if (window.MediaKeys.isTypeSupported(ContentProtection.MediaKey_FairPlay) || window.MediaKeys.isTypeSupported(null, ContentProtection.MediaKey_FairPlay)) {
                    eme += ContentProtection.MediaKey_FairPlay;
                }
            }

            //var config = [{
            //    "initDataTypes": ["cenc"],
            //    "audioCapabilities": [{
            //        "contentType": "audio/mp4;codecs=\"mp4a.40.2\""
            //    }],
            //    "videoCapabilities": [{
            //        "contentType": "video/mp4;codecs=\"avc1.42E01E\""
            //    }]
            //}];

            //try {
            //    navigator.requestMediaKeySystemAccess(ContentProtection.MediaKey_Widevine, config).then(function (mediaKeySystemAccess) {
            //        eme += ContentProtection.MediaKey_Widevine;
            //    }).catch(function (e) {
            //        console.log('no widevine support');
            //        console.log(e);
            //    });
            //} catch (e) {
            //    console.log('no widevine support');
            //    console.log(e);
            //}

            //try {
            //    navigator.requestMediaKeySystemAccess(ContentProtection.MediaKey_PlayReady, config).then(function (mediaKeySystemAccess) {
            //        eme += ContentProtection.MediaKey_PlayReady;
            //    }).catch(function (e) {
            //        console.log('no playready support');
            //        console.log(e);
            //    });
            //} catch (e) {
            //    console.log('no playready support');
            //    console.log(e);
            //}

            //try {
            //    navigator.requestMediaKeySystemAccess(ContentProtection.MediaKey_FairPlay, config).then(function (mediaKeySystemAccess) {
            //        eme += ContentProtection.MediaKey_FairPlay;
            //    }).catch(function (e) {
            //        console.log('no FairPlay support');
            //        console.log(e);
            //    });
            //} catch (e) {
            //    console.log('no FairPlay support');
            //    console.log(e);
            //}

            return eme;
        };

        BrowserUtils.supportCodec = function (videoType, codecType) {
            var vid = document.createElement('video');
            var isSupported = vid.canPlayType(videoType + ';codecs="' + codecType + '"');
            if (isSupported == "") {
                isSupported = "No";
            }
            return isSupported;
        };

        //copy textual data into clipboard
        BrowserUtils.copyToClipboard = function (text) {
            var clipboard = {
                data: "",
                intercept: false,
                hook: function (evt) {
                    if (clipboard.intercept) {
                        evt.preventDefault();
                        evt.clipboardData.setData("text/plain", clipboard.data);  //text/plain
                        clipboard.intercept = false;
                        clipboard.data = "";
                    }
                }
            };

            window.addEventListener("copy", clipboard.hook);

            clipboard.data = text;
            clipboard.intercept = true;
            document.execCommand("copy");
            window.alert("Copied to clipboard.");
        };





        //****************************************
        // DASH UTILS
        //****************************************

        function DashUtils() { }

        DashUtils.getMPD = function () {
            var segmentBaseUrl;                    //base portion of segment URL before QualityLevels($Bandwidth$)/Fragments(video=$Time$,format=mpd-time-csf)
            var videoInitialization;               //MP4 data                     

            //either CSF or CMAF
            var url = player.currentSrc();
            if (url.indexOf("format=mpd-time") < 0) {
                url = getDashUrl();
            }

            //*****use DashParser to get DASH manifest parameters
            var dashManifestRequest = new XMLHttpRequest();
            dashManifestRequest.open("GET", url, true);
            dashManifestRequest.responseType = "text";
            dashManifestRequest.onerror = function (error) {
                console.error("There was an error downloading the manifest from " + url, error);
            };
            dashManifestRequest.onload = function () {

                var dashParser = Dash.dependencies.DashParser();
                dashParser.debug = new DebugLog;
                dashParser.errHandler = new ErrorLog;
                var manifest = dashParser.parse(dashManifestRequest.response, url);
                console.log("manifest: " + manifest);

                var matrix, columns, titles;

                var ID = "mpd_table";
                // if a table with the same id exists, clean up the data first
                var tbl = document.getElementById(ID);
                if (!!tbl) {
                    while (tbl.rows.length > 0) {
                        tbl.deleteRow(0);
                    }
                } else {
                    tbl = document.createElement("table");
                    tbl.id = ID;
                }
                tbl.className = tableCssClass;

                var tblBody = document.createElement("tbody");
                var row, cell, cellText;
                var headers = ["Node", "Attribute", "Value"];



                var videoAdaptationSet = manifest.Period.AdaptationSet.filter(function (adaptationSet) {
                    return (!!adaptationSet.contentType && adaptationSet.contentType.toLowerCase() === 'video') ||
                        (!!adaptationSet.mimeType && adaptationSet.mimeType.toLowerCase() === 'video/mp4');
                })[0];
                matrix = DashUtils.getAdaptationSetMatrix(videoAdaptationSet);

                var i, j;
                //create data rows
                if (!!matrix && matrix.length > 0) {

                    titles = ["", "VIDEO (ID: " + videoAdaptationSet.id + "):"];  //multi-row

                    //space and title on top of table          
                    for (i = 0; i < titles.length; i++) {
                        row = document.createElement("tr");
                        cell = document.createElement("td");
                        cell.colSpan = headers.length;
                        cell.className = titleCssClass;
                        cellText = document.createTextNode(titles[i]);
                        cell.appendChild(cellText);
                        row.appendChild(cell);
                        tblBody.appendChild(row);
                    }
                    //create column headers row
                    row = document.createElement("tr");
                    for (i = 0; i < headers.length; i++) {
                        cell = document.createElement("th");
                        cellText = document.createTextNode(headers[i]);
                        cell.appendChild(cellText);
                        row.appendChild(cell);
                    }
                    tblBody.appendChild(row);

                    //data
                    for (i = 0; i < matrix.length; i++) {
                        row = document.createElement("tr");
                        row.id = "video_adaptationset_" + i;   //used to update background of currentPlaybackBitrate

                        columns = [matrix[i].node,
                        matrix[i].attribute,
                        matrix[i].value
                        ];

                        for (j = 0; j < columns.length; j++) {
                            cell = document.createElement("td");
                            cellText = document.createTextNode(columns[j]);
                            cell.appendChild(cellText);
                            row.appendChild(cell);
                        }

                        tblBody.appendChild(row);
                    }
                }




                //get $Bandwidth$ - the lowest bitrate (both $Bandwidth$ and initialization are required to build the URL for requesting video initialization
                //bandwidth = getLowestBitrate();

                //get segmentBaseUrl
                //segmentBaseUrl = getSmoothUrl().replace("Manifest", "").replace("manifest", "");

                //get URL for video initialization
                //if (!!initialization /*&& !!bandwidth*/) {
                //    var videoInitializationUrl = segmentBaseUrl + initialization; //.replace("$Bandwidth$", bandwidth);
                //    console.log(videoInitializationUrl);
                //msg += "\n - " + BrowserUtils.wrapText("video initialization URL: " + videoInitializationUrl);

                //request videoInitialization
                //BrowserUtils.xhrRequest(videoInitializationUrl, "GET", "arraybuffer", "", "", function (data) {
                //    if (!!data) {
                //        videoInitialization = data;
                //        console.log(videoInitialization);
                //    }
                //});
                //}

                var audioAdaptationSets = manifest.Period.AdaptationSet.filter(function (adaptationSet) {
                    return (!!adaptationSet.contentType && adaptationSet.contentType.toLowerCase() === 'audio') ||
                        (!!adaptationSet.mimeType && adaptationSet.mimeType.toLowerCase() === 'audio/mp4');
                });  //may have more than 1 audio streams

                var audioSegmentTemplate;
                if (!!audioAdaptationSets && audioAdaptationSets.length > 0) {
                    for (i = 0; i < audioAdaptationSets.length; i++) {

                        titles = ["", "AUDIO (ID: " + audioAdaptationSets[i].id + "):"];  //multi-row

                        //space and title on top of table          
                        for (var m = 0; m < titles.length; m++) {
                            row = document.createElement("tr");
                            cell = document.createElement("td");
                            cell.colSpan = headers.length;
                            cell.className = titleCssClass;
                            cellText = document.createTextNode(titles[m]);
                            cell.appendChild(cellText);
                            row.appendChild(cell);
                            tblBody.appendChild(row);
                        }

                        //create column headers row
                        row = document.createElement("tr");
                        for (var n = 0; n < headers.length; n++) {
                            cell = document.createElement("th");
                            cellText = document.createTextNode(headers[n]);
                            cell.appendChild(cellText);
                            row.appendChild(cell);
                        }
                        tblBody.appendChild(row);
                        //data
                        matrix = DashUtils.getAdaptationSetMatrix(audioAdaptationSets[i]);
                        if (!!matrix && matrix.length > 0) {
                            for (var ii = 0; ii < matrix.length; ii++) {
                                row = document.createElement("tr");
                                row.id = "audio_adaptationset_" + i + "_" + ii;   //used to update background of currentPlaybackBitrate

                                columns = [matrix[ii].node,
                                matrix[ii].attribute,
                                matrix[ii].value
                                ];

                                for (j = 0; j < columns.length; j++) {
                                    cell = document.createElement("td");
                                    cellText = document.createTextNode(columns[j]);
                                    cell.appendChild(cellText);
                                    row.appendChild(cell);
                                }

                                tblBody.appendChild(row);
                            }
                        }
                    }
                }

                // append the <tbody> inside the <table>
                tbl.appendChild(tblBody);

                //display
                player.overlay.eventdiv.appendChild(tbl);

                //DataView of 1st segment of video AdaptationSet - highest bitrate track
                DashUtils.get1stSegmentDataView(videoAdaptationSet);

                //DataView of initialization of video AdaptationSet - highest bitrate track
                DashUtils.getInitializationDataView(videoAdaptationSet);

            };
            dashManifestRequest.send();

        };  //getMPD


        //parse an AdaptationSet and return its properties in an array
        DashUtils.getAdaptationSetMatrix = function (adaptationSet) {
            var segmentTemplate = adaptationSet.SegmentTemplate;
            var segmentTimeline = segmentTemplate.SegmentTimeline;

            var segmentCount = 0;  //number of segments
            var segment;
            var segmentStart = 0;
            var repeat;
            var segments = [];   //array holding time segments {start: m, end: n}, in timescale
            if (!!segmentTimeline.S_asArray && segmentTimeline.S_asArray.length > 0) {
                console.log("segmentTimeline.S_asArray.length = " + segmentTimeline.S_asArray.length);

                for (var i = 0; i < segmentTimeline.S_asArray.length; i++) {
                    repeat = segmentTimeline.S_asArray[i].r;
                    //console.log("repeat = " + repeat);
                    if (!!repeat && repeat >= 1) {
                        segmentStart = segmentTimeline.S_asArray[i].t || segmentStart;
                        for (var j = 0; j <= repeat; j++) {
                            segment = {
                                start: segmentStart,
                                end: segmentStart + segmentTimeline.S_asArray[i].d
                            };
                            segments.push(segment);
                            //increment counters
                            segmentStart += segmentTimeline.S_asArray[i].d;
                            segmentCount++;
                        }
                    } else {
                        segmentStart = segmentTimeline.S_asArray[i].t || segmentStart;
                        segment = {
                            start: segmentStart,
                            end: segmentStart + segmentTimeline.S_asArray[i].d
                        };
                        segments.push(segment);
                        segmentStart += segmentTimeline.S_asArray[i].d;
                        segmentCount++;
                    }
                }
            }   //after the loop, segmentStart = total duration = Sum(all d)

            var matrix = [];
            var elements = [];

            elements[0] = {
                node: "AdaptationSet",
                attribute: "id",
                value: adaptationSet.id
            };
            elements[1] = {
                node: "AdaptationSet",
                attribute: "contentType",
                value: adaptationSet.contentType
            };
            elements[2] = {
                node: "AdaptationSet",
                attribute: "mimeType",
                value: adaptationSet.mimeType
            };
            elements[3] = {
                node: "AdaptationSet",
                attribute: "codecs",
                value: adaptationSet.codecs
            };
            elements[4] = {
                node: "AdaptationSet",
                attribute: "profiles",
                value: adaptationSet.profiles
            };
            elements[5] = {
                node: "AdaptationSet",
                attribute: "segmentAlignment",
                value: adaptationSet.segmentAlignment
            };
            elements[6] = {
                node: "AdaptationSet",
                attribute: "bitstreamSwitching",
                value: adaptationSet.bitstreamSwitching
            };
            elements[7] = {
                node: "SegmentTemplate",
                attribute: "timescale",
                value: segmentTemplate.timescale
            };
            elements[8] = {
                node: "SegmentTemplate",
                attribute: "initialization",
                value: segmentTemplate.initialization
            };
            elements[9] = {
                node: "SegmentTemplate",
                attribute: "media",
                value: segmentTemplate.media
            };
            elements[10] = {
                node: "SegmentTimeline",
                attribute: "timeline info",
                value: "total # of segments: " + segments.length + ", from " + segments[0].start + " to " + segments[segments.length - 1].end
            };
            elements[11] = {
                node: "SegmentTimeline",
                attribute: "timeline info",
                value: "d-average: " + (segments.length > 1 ? ((segments[segments.length - 1].start - segments[0].start) / (segments.length - 1)).toFixed(0) : segmentTimeline.S_asArray[0].d)  //the last segment is usually a fraction of regular d, neglected for average-d computation
            };

            for (var k = 0; k < elements.length; k++) {
                matrix.push(elements[k]);
            }
            return matrix;
        };

        var DebugLog = (function () {
            function DebugLog() {
                this.log = function (message) {
                    console.log(message);
                };
            }
            return DebugLog;
        })();

        var ErrorLog = (function () {
            function ErrorLog() {
                this.manifestError = function (message, id, manifest) {
                    console.error(message);
                };
            }
            return ErrorLog;
        })();


        //parse the video AdaptationSet, get DataView for the 1st segment of highest bitrate/track, then parse ISOBMFF boxes in the segment
        DashUtils.get1stSegmentDataView = function (adaptationSet) {
            //constants
            const manifestExtension     = ".ism";
            const streamingUrlComponent = manifestExtension + "/manifest";
            const bandwidthPlaceholder  = "$Bandwidth$";
            const timePlaceholder       = "$Time$";

            //get base URL to construct segment URL later
            var currentSrc = player.currentSrc();
            var streamingUrlComponentIndex = currentSrc.toLowerCase().lastIndexOf(streamingUrlComponent);
            var baseManifestUrl = currentSrc.substring(0, streamingUrlComponentIndex + manifestExtension.length) + '/';

            //get 1st video segment URL using DashParser
            var segmentTemplate = adaptationSet.SegmentTemplate;
            var segmentTimeline = segmentTemplate.SegmentTimeline;
            var firstVideoSegmentStartTime = +(segmentTimeline.S_asArray[0].t || 0);
            var firstVideoSegmentDuration = segmentTimeline.S_asArray[0].d;
            var relativeVideoFragmentUrlTemplate = segmentTemplate.media;
            //var videoBandwidth = +adaptationSet.Representation_asArray[adaptationSet.Representation_asArray.length - 1].bandwidth;

            //use the highest bitrate/track
            var videoBandwidth = getHighestBitrate(player);
            var firstVideoFragmentUrl = baseManifestUrl + relativeVideoFragmentUrlTemplate.replace(bandwidthPlaceholder, videoBandwidth).replace(timePlaceholder, firstVideoSegmentStartTime);

            // Download MPEG-DASH video fragment
            var firstVideoFragmentRequest = new XMLHttpRequest();
            firstVideoFragmentRequest.open("GET", firstVideoFragmentUrl, true);
            firstVideoFragmentRequest.responseType = "arraybuffer";
            firstVideoFragmentRequest.onerror = function (error) {
                console.error("There was an error downloading the '" + firstVideoFragmentUrl + "' video segment to get DataView.", error);
                //player.trigger(mediaPlayer.eventName.framerateerror);
            };
            firstVideoFragmentRequest.onload = function () {
                if (firstVideoFragmentRequest.status < 200 || firstVideoFragmentRequest.status >= 300) {
                    console.error("There was an error downloading the '" + firstVideoFragmentUrl + "' video segment to get DataView.");
                    player.trigger(mediaPlayer.eventName.framerateerror);
                    return;
                }

                var dataView; //for the 1st video segment;
                try {
                    dataView = new DataView(firstVideoFragmentRequest.response);
                } catch (error) {
                    console.warn("There was an error in building the DataView of the first video segment.");
                }

                //collect data
                var matrix = [];
                matrix.push({
                    node: "1st Segment",
                    attribute: "byteLength",
                    value: addCommas(dataView.byteLength)
                });

                var startPosition = 0;
                // Find "moof" box.
                var moofBoxStartPosition = getBoxStartPosition("moof", startPosition, dataView);
                // Find "moof/traf" box.
                var trafBoxStartPosition = getBoxStartPosition("traf", moofBoxStartPosition, dataView);
                // Find "moof/traf/tfhd" box.
                var tfhdBoxStartPosition = getBoxStartPosition("tfhd", trafBoxStartPosition, dataView);
                // Find "moof/traf/trun" box
                var trunBoxStartPosition = getBoxStartPosition("trun", trafBoxStartPosition, dataView);
                // if defaultSampleDuration <= 0 in the "moof/traf/tfhd" box. Find "moof/traf/trun" box.
                // Skip version and flags.
                trunBoxStartPosition += 4;
                var sampleCount = dataView.getUint32(trunBoxStartPosition);

                matrix.push({
                    node: "moof",
                    attribute: "box start position",
                    value: moofBoxStartPosition
                });
                matrix.push({
                    node: "moof/traf",
                    attribute: "box start position",
                    value: trafBoxStartPosition
                });

                matrix.push({
                    node: "moof/traf/trun",
                    attribute: "box start position",
                    value: trunBoxStartPosition
                });
                matrix.push({
                    node: "moof/traf/trun",
                    attribute: "sample count",
                    value: sampleCount
                });

                //"tfhd" box
                matrix.push({
                    node: "moof/traf/tfhd",
                    attribute: "box start position",
                    value: tfhdBoxStartPosition
                });
                var fullbox = dataView.getUint32(tfhdBoxStartPosition);
                var version = (fullbox >> 0x18) & 0xff;
                var flags = fullbox & 0xffffff;
                //skip version/flags
                tfhdBoxStartPosition += 4;
                var track_ID = dataView.getUint32(tfhdBoxStartPosition);
                matrix.push({
                    node: "moof/traf/tfhd",
                    attribute: "flags (bit)",
                    value: flags.toString(2)
                });
                matrix.push({
                    node: "moof/traf/tfhd",
                    attribute: "track_ID",
                    value: track_ID
                });
                //skip track_ID
                tfhdBoxStartPosition += 4;
                //skip base_data_offset position.
                if ((flags & 1) !== 0) {       
                    tfhdBoxStartPosition += 8; //(64-bit)
                }
                if ((flags & 2) !== 0) {
                    var sample_description_index = dataView.getUint32(tfhdBoxStartPosition);
                    matrix.push({
                        node: "moof/traf/tfhd",
                        attribute: "sample_description_index",
                        value: sample_description_index
                    });
                    //skip sample_description_index.
                    boxPosition += 4;
                }
                if ((flags & 8) !== 0) {
                    var default_sample_duration = dataView.getUint32(tfhdBoxStartPosition);
                    matrix.push({
                        node: "moof/traf/tfhd",
                        attribute: "default_sample_duration",
                        value: default_sample_duration
                    });
                    //skip default_sample_duration;
                    tfhdBoxStartPosition += 4;

                }
                if ((flags & 16) !== 0) {
                    var default_sample_size = dataView.getUint32(tfhdBoxStartPosition);
                    matrix.push({
                        node: "moof/traf/tfhd",
                        attribute: "default_sample_size",
                        value: default_sample_size
                    });
                    //skil default_sample_size
                    tfhdBoxStartPosition += 4;
                }
                if ((flags & 32) !== 0) {
                    var default_sample_flags = dataView.getUint32(tfhdBoxStartPosition);
                    matrix.push({
                        node: "moof/traf/tfhd",
                        attribute: "default_sample_flags (bit)",
                        value: default_sample_flags.toString(2)
                    });
                    //skil default_sample_flags
                    tfhdBoxStartPosition += 4;
                }
    
                //display
                displayMatrix(matrix);
            };

            firstVideoFragmentRequest.send();
        };


        //parse video AdaptationSet, and get DataView for the initialization for the highest bitrate/track, then parse ISOBMFF boxes 
        DashUtils.getInitializationDataView = function (adaptationSet) {
            //constants
            const manifestExtension = ".ism";
            const streamingUrlComponent = manifestExtension + "/manifest";
            const bandwidthPlaceholder = "$Bandwidth$";
            const timePlaceholder = "$Time$";

            //get base URL to construct segment URL later
            var currentSrc = player.currentSrc();
            var streamingUrlComponentIndex = currentSrc.toLowerCase().lastIndexOf(streamingUrlComponent);
            var baseManifestUrl = currentSrc.substring(0, streamingUrlComponentIndex + manifestExtension.length) + '/';

            //get 1st video segment URL using DashParser
            var segmentTemplate = adaptationSet.SegmentTemplate;
            var segmentTimeline = segmentTemplate.SegmentTimeline;
            var initialization = segmentTemplate.initialization; 

            //use highest bitrate/track
            var topVideoBandwidth = getHighestBitrate(player);
            var initializationUrl = baseManifestUrl + initialization.replace("$Bandwidth$", topVideoBandwidth);
            console.log("initializationUrl: " + initializationUrl);

            // Download MPEG-DASH video initialization
            var initializationRequest = new XMLHttpRequest();
            initializationRequest.open("GET", initializationUrl, true);
            initializationRequest.responseType = "arraybuffer";
            initializationRequest.onerror = function (error) {
                console.error("There was an error downloading the '" + initializationUrl + "' video initialization to get DataView.", error);
            };
            initializationRequest.onload = function () {
                if (initializationRequest.status < 200 || initializationRequest.status >= 300) {
                    console.error("There was an error downloading the '" + initializationUrl + "' video initialization to get DataView.");
                    player.trigger(mediaPlayer.eventName.framerateerror);
                    return;
                }

                var dataView; //for the initialization of top bitrate track;
                try {
                    dataView = new DataView(initializationRequest.response);
                } catch (error) {
                    console.warn("There was an error in building the DataView of the video initialization.");
                }

                //parsing initialization boxes
                var startPosition = 0;
                // ftyp box properties
                var ftypStartPosition = getBoxStartPosition("ftyp", startPosition, dataView);
                var major_brand = dataView.getUint32(ftypStartPosition);         //ccff=1667458662
                ftypStartPosition += 4;
                var minor_version = dataView.getUint32(ftypStartPosition);
                ftypStartPosition += 4;
                var compatible_brands = dataView.getUint32(ftypStartPosition);   //iso6=1769172790

                //moov box properties
                var moovBoxStartPosition = getBoxStartPosition("moov", startPosition, dataView);
                var mvhdBoxStartPosition = getBoxStartPosition("mvhd", moovBoxStartPosition, dataView);

                //mvhd box has version and flags
                var fullbox = dataView.getUint32(mvhdBoxStartPosition);
                var version = (fullbox >> 0x18) & 0xff;
                var flags = fullbox & 0xffffff;
                //skip the 1st byte containing version and flags
                mvhdBoxStartPosition += 4;
                if (version === 1) {
                    //skip creation_time, modification_time, each 8 bytes
                    mvhdBoxStartPosition += 16;
                } else if (version === 0) {
                    //skip creation_time, modification_time, each 4 bytes
                    mvhdBoxStartPosition += 8;
                }
                var timescale = dataView.getUint32(mvhdBoxStartPosition);

                //trak box
                var trakBoxStartPosition = getBoxStartPosition("trak", moovBoxStartPosition, dataView);
                var mdiaBoxStartPosition = getBoxStartPosition("mdia", trakBoxStartPosition, dataView);
                var minfBoxStartPosition = getBoxStartPosition("minf", mdiaBoxStartPosition, dataView);
                var stblBoxStartPosition = getBoxStartPosition("stbl", minfBoxStartPosition, dataView);
                var stsdBoxStartPosition = getBoxStartPosition("stsd", stblBoxStartPosition, dataView);

                /* The stsd (Sample Description Box) can be treated like a box that contains other boxes. 
                   Each Sample Entry is also just a normal box:
                     4 bytes - length in total
                     4 bytes - 4 char code of sample description table (stsd)
                     4 bytes - version (1 byte) & flags (3 bytes)  Fullbox
                     4 bytes - number of sample entries (num_sample_entries)
                     [
                        4 bytes - length of sample entry (len_sample_entry)
                        4 bytes - 4 char code of sample entry
                        ('len_sample_entry' - 8) bytes of data
                     ] (repeated 'num_sample_entries' times)
                     (4 bytes - optional 0x00000000 as end of box marker )
                */
                stsdBoxStartPosition += 4;  //size (4), type (4), [position here] version (1), flags (3). stsdBoxStartPosition -= 4 will be "stsd"
                var num_sample_entries = dataView.getUint32(stsdBoxStartPosition);
                stsdBoxStartPosition += 4;  
                var k;
                var sample_entries = [];
                var sample_entry;
                var len_sample_entry;
                if (num_sample_entries > 0) {
                    for (k = 0; k < num_sample_entries; k++) {
                        len_sample_entry = dataView.getUint32(stsdBoxStartPosition);
                        stsdBoxStartPosition += 4;
                        sample_entry = dataView.getUint32(stsdBoxStartPosition);
                        sample_entries.push(sample_entry);
                        stsdBoxStartPosition += len_sample_entry - 4;
                    }
                }

                //stco (Chunk Offset Box)
                var stcoBoxStartPosition = getBoxStartPosition("stco", stblBoxStartPosition, dataView);
                stcoBoxStartPosition += 4; 
                var entry_count_stco = dataView.getUint32(stcoBoxStartPosition);
                var chunk_offsets = [];
                var chunk_offset;
                if (entry_count_stco > 0) {
                    for (k = 0; k < entry_count_stco; k++) {
                        stcoBoxStartPosition += 4; 
                        chunk_offset = dataView.getUint32(stcoBoxStartPosition);
                        chunk_offsets.push(chunk_offset);
                    }
                }

                //co64 (ChunkLargeOffsetBox)
                //var co64BoxStartPosition = getBoxStartPosition("co64", stblBoxStartPosition, dataView);
                //co64BoxStartPosition += 4;
                //var entry_count_co64 = dataView.getUint32(co64BoxStartPosition);
                //var chunk_offsets_co64 = [];
                //if (entry_count_co64 > 0) {
                //    for (k = 0; k < entry_count_co64; k++) {
                //        co64BoxStartPosition += 8;
                //        chunk_offset = dataView.getFloat64(co64BoxStartPosition);
                //        chunk_offsets_co64.push(chunk_offset);
                //    }
                //}
                
                //dref box
                var dinfBoxStartPosition = getBoxStartPosition("dinf", minfBoxStartPosition, dataView);
                var drefBoxStartPosition = getBoxStartPosition("dref", dinfBoxStartPosition, dataView);
                drefBoxStartPosition += 4; 
                var entry_count_dref = dataView.getUint32(drefBoxStartPosition);

                var data_entries = [];
                var str;
                var byte;
                if (entry_count_dref > 0) {
                    for (k = 0; k < entry_count_dref; k++) {
                        str = "";
                        drefBoxStartPosition += 3; 
                        do {
                            byte = dataView.getUint8(drefBoxStartPosition);
                            if (byte !== 0) {
                                str += intTo256BigEndianString(byte);
                            }
                            drefBoxStartPosition += 1;
                        } while (byte !== 0);
                        data_entries.push(str);
                    }
                }

                //collect data
                var matrix = [];
                matrix.push({
                    node: "Initialization",
                    attribute: "byteLength",
                    value: addCommas(dataView.byteLength)
                });
                matrix.push({
                    node: "ftyp",
                    attribute: "major_brand",
                    value: intTo256BigEndianString(major_brand)
                });
                matrix.push({
                    node: "ftyp",
                    attribute: "minor_version",
                    value: minor_version
                });
                matrix.push({
                    node: "ftyp",
                    attribute: "compatible_brands",
                    value: intTo256BigEndianString(compatible_brands)
                });
                matrix.push({
                    node: "moov/mvhd",
                    attribute: "version",
                    value: version
                });
                matrix.push({
                    node: "moov/mvhd",
                    attribute: "flags",
                    value: flags
                });
                matrix.push({
                    node: "moov/mvhd",
                    attribute: "timescale",
                    value: timescale
                });
                matrix.push({
                    node: "moov/trak/mdia/minf/stbl/stsd",
                    attribute: "num_sample_entries",
                    value: num_sample_entries
                });
                for (k = 0; k < sample_entries.length; k++) {
                    matrix.push({
                        node: "moov/trak/mdia/minf/stbl/stsd",
                        attribute: "sample_entry",
                        value: intTo256BigEndianString(sample_entries[k])
                    });
                }  
                matrix.push({
                    node: "moov/trak/mdia/minf/stbl/stco",
                    attribute: "entry_count",
                    value: entry_count_stco
                });
                for (k = 0; k < chunk_offsets.length; k++) {
                    matrix.push({
                        node: "moov/trak/mdia/minf/stbl/stco",
                        attribute: "chunk_offset",
                        value: chunk_offsets[k]
                    });
                }
                //matrix.push({
                //    node: "moov/trak/mdia/minf/stbl/co64",
                //    attribute: "entry_count",
                //    value: entry_count_co64
                //});
                //for (k = 0; k < chunk_offsets_co64.length; k++) {
                //    matrix.push({
                //        node: "moov/trak/mdia/minf/stbl/co64",
                //        attribute: "chunk_offset",
                //        value: chunk_offsets_co64[k]
                //    });
                //}
                matrix.push({
                    node: "moov/trak/mdia/minf/dinf/dref",
                    attribute: "entry_count",
                    value: entry_count_dref
                });
                for (k = 0; k < data_entries.length; k++) {
                    matrix.push({
                        node: "moov/trak/mdia/minf/dinf/dref",
                        attribute: "data_entry",
                        value: data_entries[k]
                    });
                }

                //display
                displayMatrix(matrix);
            };

            initializationRequest.send();
        };

        //display a matrix in the UI table
        function displayMatrix(matrix) {
            var ID = "mpd_table";
            // if a table with the same id exists, clean up the data first
            var tbl = document.getElementById(ID);
            if (!!tbl) {
                var tblBody = document.createElement("tbody");
                var row;
                var cell;
                var cellText;
                var columns;

                for (var i = 0; i < matrix.length; i++) {
                    //each matrix element maps to a row
                    row = document.createElement("tr");

                    columns = [matrix[i].node,
                    matrix[i].attribute,
                    matrix[i].value
                    ];

                    for (var j = 0; j < columns.length; j++) {
                        cell = document.createElement("td");
                        cellText = document.createTextNode(columns[j]);
                        cell.appendChild(cellText);
                        row.appendChild(cell);
                    }
                    tblBody.appendChild(row);
                }

                // append the <tbody> inside the <table>
                tbl.appendChild(tblBody);
            }
        }


        function getType(typeString) {
            var c1 = typeString.charCodeAt(0);
            var c2 = typeString.charCodeAt(1);
            var c3 = typeString.charCodeAt(2);
            var c4 = typeString.charCodeAt(3);

            var type = ((((c1 << 0x18) | (c2 << 0x10)) | (c3 << 8)) | c4);

            return type >>> 0;
        }

        function intTo256BigEndianString(n) {
            var result = "";

            for (var i = 0; i < 28; i++) {
                result += String.fromCharCode(0x00);
            }

            result += String.fromCharCode((n >> 24) & 0xFF);
            result += String.fromCharCode((n >> 16) & 0xFF);
            result += String.fromCharCode((n >> 8) & 0xFF);
            result += String.fromCharCode((n >> 0) & 0xFF);

            return result;
        }

        // Gets the start position of the box content and its size. 
        /* Box structure:
           [4-byte-box-size][4-byte-box-type] (  Box    (unsigned int(32) boxtype, optional unsigned int(8)[16] extended_type)  )
           [1-byte-version ][3-byte-flags   ] (  FullBox(unsigned int(32) boxtype, unsigned int(8) v,               bit(24) f)  )
           [box-data]
         */
        function getBoxStartPosition(typeString, startPosition, dataView) {
            var uuidBoxType = getType("uuid"),
                boxType = getType(typeString),
                boxStartPosition = startPosition,
                boxSize = 0,
                boxEndPosition = boxStartPosition + boxSize;

            do {
                boxStartPosition = boxEndPosition;

                boxSize = dataView.getUint32(boxStartPosition);
                boxStartPosition += 4;

                boxEndPosition += boxSize;

                var type = dataView.getUint32(boxStartPosition);
                boxStartPosition += 4;

                if (type === uuidBoxType) {
                    boxStartPosition += 16;
                }
            } while ((type !== boxType) && (dataView.byteLength >= boxStartPosition));

            return boxStartPosition;
        }


        function getVideoTrackArray(amPlayer) {
            var videoTrackArray = [];

            if (amPlayer.currentVideoStreamList() != undefined) {
                var videoStreamList = amPlayer.currentVideoStreamList();
                var videoTracks;

                for (var i = 0; i < videoStreamList.streams.length; i++) {
                    videoTracks = videoStreamList.streams[i].tracks;
                    if (videoTracks != undefined) {
                        for (var j = 0; j < videoTracks.length; j++)
                            videoTrackArray.push({
                                bitrate: videoTracks[j].bitrate,
                                width: videoTracks[j].width,
                                height: videoTracks[j].height,
                                selectable: videoTracks[j].selectable
                            });
                    }
                }
            }

            return videoTrackArray;
        }

        function getLowestBitrate(player) {
            var videoTrackArray = getVideoTrackArray(player);
            var bitrates = [];
            for (var i = 0; i < videoTrackArray.length; i++) {
                bitrates.push(videoTrackArray[i].bitrate);
            }
            return Math.min.apply(null, bitrates);
        }

        function getHighestBitrate(player) {
            var videoTrackArray = getVideoTrackArray(player);
            var bitrates = [];
            for (var i = 0; i < videoTrackArray.length; i++) {
                bitrates.push(videoTrackArray[i].bitrate);
            }
            return Math.max.apply(null, bitrates);
        }

        DashUtils.getLiveArchiveInfo = function () {

            //either CSF or CMAF
            var url = player.currentSrc();
            if (url.indexOf("format=mpd-time") < 0) {
                url = getDashUrl();
            }

            //*****use DashParser to get DASH manifest parameters
            var dashManifestRequest = new XMLHttpRequest();
            dashManifestRequest.open("GET", url, true);
            dashManifestRequest.responseType = "text";
            dashManifestRequest.onerror = function (error) {
                console.error("There was an error downloading the manifest from " + url, error);
            };
            dashManifestRequest.onload = function () {

                //dashParser
                var dashParser = Dash.dependencies.DashParser();
                dashParser.debug = new DebugLog;
                dashParser.errHandler = new ErrorLog;
                var manifest = dashParser.parse(dashManifestRequest.response, url);

                //AdaptationSet
                var videoAdaptationSet = manifest.Period.AdaptationSet.filter(function (adaptationSet) {
                    return (!!adaptationSet.contentType && adaptationSet.contentType.toLowerCase() === 'video') ||
                        (!!adaptationSet.mimeType && adaptationSet.mimeType.toLowerCase() === 'video/mp4');
                })[0];

                //SegmentTemplate, SegmentTimeline
                var segmentTemplate = videoAdaptationSet.SegmentTemplate;
                var segmentTimeline = segmentTemplate.SegmentTimeline;

                var segment;
                var segmentStart = 0;
                var repeat;
                var segments = [];   //array holding time segments {start: m, end: n}, in timescale
                if (!!segmentTimeline.S_asArray && segmentTimeline.S_asArray.length > 0) {
                    console.log("segmentTimeline.S_asArray.length = " + segmentTimeline.S_asArray.length);

                    for (var i = 0; i < segmentTimeline.S_asArray.length; i++) {
                        repeat = segmentTimeline.S_asArray[i].r;
                        //console.log("repeat = " + repeat);
                        if (!!repeat && repeat >= 1) {
                            segmentStart = segmentTimeline.S_asArray[i].t || segmentStart;
                            for (var j = 0; j <= repeat; j++) {
                                segment = {
                                    start: segmentStart,
                                    end: segmentStart + segmentTimeline.S_asArray[i].d
                                };
                                segments.push(segment);
                                //increment counters
                                segmentStart += segmentTimeline.S_asArray[i].d;
                            }
                        } else {
                            segmentStart = segmentTimeline.S_asArray[i].t || segmentStart;
                            segment = {
                                start: segmentStart,
                                end: segmentStart + segmentTimeline.S_asArray[i].d
                            };
                            segments.push(segment);
                            segmentStart += segmentTimeline.S_asArray[i].d;
                        }
                    }
                }   //after the loop, segmentStart = total duration = Sum(all d)

                var presentationTimeOffset = segments[0].start;
                var presentationEnd = segments[segments.length - 1].end;
                var timescale = segmentTemplate.timescale;
                var media = segmentTemplate.media;
                var mimeType = videoAdaptationSet.mimeType;
                var contentType = videoAdaptationSet.contentType;
                var codecs = videoAdaptationSet.codecs;
                var profiles = videoAdaptationSet.profiles;
                var liveArchiveStart;
                if (presentationTimeOffset > 0) {
                    liveArchiveStart = TimeUtils.hnsToUtc(presentationTimeOffset).toGMTString();
                } else {
                    liveArchiveStart = "(This is a VOD, instead of a live archive.)";
                }

                var msg = "\n - media: " + media +
                    "\n - codecs: " + codecs +
                    "\n - mime type: " + mimeType +
                    "\n - content type: " + contentType + 
                    "\n - profiles: " + profiles +
                    "\n - live archive start time: " + liveArchiveStart +
                    "\n - absolute time conversion from relative time = " + presentationTimeOffset + " + " + timescale + " x [# of seconds from start]";
                player.overlay.eventdiv.innerText = msg;
            };

            dashManifestRequest.send();
        };


        //****************************************
        // DRM
        //****************************************

        //credit: http://dean.edwards.name/weblog/2009/12/getelementsbytagname/ This works in all major browsers
        function getElementsByTagNameCustom(node, tagName) {
            var elements = [], i = 0, anyTag = tagName === "*", next = node.firstChild;
            while ((node = next)) {
                if (anyTag ? node.nodeType === 1 : node.nodeName === tagName) elements[i++] = node;
                next = node.firstChild || node.nextSibling;
                while (!next && (node = node.parentNode)) next = node.nextSibling;
            }
            return elements;
        }

        //decode base64 binary and display in <div id="info">
        function decodeBase64(base64Data) {
            var a = Base64Binary.decode(base64Data), h = new Blob([a]), f = new FileReader;
            f.onload = function (a) {
                a = "ascii";
                f.onload = function (a) {
                    //put protection header in pre
                    var protectionHeader = a.target.result.replace(/[^\x20-\x7E]/g, '');
                    player.overlay.pre.textContent = protectionHeader;
                    player.overlay.pre.style.display = "block";

                    var laurl = extractFromProtectionHeader(protectionHeader, "LA_URL");
                    player.overlay.eventdiv.innerText += "\nPlayReady LA_URL: " + laurl +
                        "\nmspr:pro: ";

                }, f.readAsText(h, a);
            };
            f.readAsArrayBuffer(h);
        }

        function extractFromProtectionHeader(protectionHeader, node) {
            var start = "<" + node + ">";
            var end = "</" + node + ">";
            var startIndex = protectionHeader.indexOf(start) + 2 + node.length;
            var endIndex = protectionHeader.indexOf(end);

            return protectionHeader.substring(startIndex, endIndex);
        }

        //credit goes to: http://base64online.org/decode/ for Base64Binary
        var Base64Binary = {
            _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

            /* will return a  Uint8Array type */
            decodeArrayBuffer: function (input) {
                var bytes = (input.length / 4) * 3;
                var ab = new ArrayBuffer(bytes);
                this.decode(input, ab);

                return ab;
            },

            decode: function (input, arrayBuffer) {
                //get last chars to see if are valid
                var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1));
                var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2));

                var bytes = (input.length / 4) * 3;
                if (lkey1 == 64) bytes--; //padding chars, so skip
                if (lkey2 == 64) bytes--; //padding chars, so skip

                var uarray;
                var chr1, chr2, chr3;
                var enc1, enc2, enc3, enc4;
                var i = 0;
                var j = 0;

                if (arrayBuffer)
                    uarray = new Uint8Array(arrayBuffer);
                else
                    uarray = new Uint8Array(bytes);

                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

                for (i = 0; i < bytes; i += 3) {
                    //get the 3 octects in 4 ascii chars
                    enc1 = this._keyStr.indexOf(input.charAt(j++));
                    enc2 = this._keyStr.indexOf(input.charAt(j++));
                    enc3 = this._keyStr.indexOf(input.charAt(j++));
                    enc4 = this._keyStr.indexOf(input.charAt(j++));

                    chr1 = (enc1 << 2) | (enc2 >> 4);
                    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                    chr3 = ((enc3 & 3) << 6) | enc4;

                    uarray[i] = chr1;
                    if (enc3 !== 64) uarray[i + 1] = chr2;
                    if (enc4 !== 64) uarray[i + 2] = chr3;
                }

                return uarray;
            },

            encode: function base64ArrayBuffer(arrayBuffer) {
                var base64 = '';
                var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

                var bytes = new Uint8Array(arrayBuffer);
                var byteLength = bytes.byteLength;
                var byteRemainder = byteLength % 3;
                var mainLength = byteLength - byteRemainder;

                var a, b, c, d;
                var chunk;

                // Main loop deals with bytes in chunks of 3
                for (var i = 0; i < mainLength; i = i + 3) {
                    // Combine the three bytes into a single integer
                    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

                    // Use bitmasks to extract 6-bit segments from the triplet
                    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
                    b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
                    c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
                    d = chunk & 63;               // 63       = 2^6 - 1

                    // Convert the raw binary segments to the appropriate ASCII encoding
                    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
                }

                // Deal with the remaining bytes and padding
                if (byteRemainder == 1) {
                    chunk = bytes[mainLength];

                    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

                    // Set the 4 least significant bits to zero
                    b = (chunk & 3) << 4; // 3   = 2^2 - 1

                    base64 += encodings[a] + encodings[b] + '==';
                } else if (byteRemainder == 2) {
                    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

                    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
                    b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

                    // Set the 2 least significant bits to zero
                    c = (chunk & 15) << 2; // 15    = 2^4 - 1

                    base64 += encodings[a] + encodings[b] + encodings[c] + '=';
                }

                return base64;
            }
        };  //Base64Binary

        function getProtectionInfo() {
            var msg = "";

            //DASH
            var urlDASH = getDashUrl();
            BrowserUtils.xhrRequest(urlDASH, "GET", "", "", "useResponseXML", function (xml) {
                if (!!xml) {
                    //CENC
                    var cencElements = xml.getElementsByTagName("ContentProtection");
                    if (cencElements != undefined && cencElements.length > 0) {
                        for (var j = 0; j < cencElements.length; j++) {
                            msg += "\n" + cencElements[j].parentNode.getAttribute("mimeType") + "/" +
                                cencElements[j].parentNode.getAttribute("codecs") + "/" +
                                cencElements[j].parentNode.getAttribute("contentType") + ": " +
                                "\n - cenc:default_KID: " + cencElements[j].getAttribute("cenc:default_KID") +
                                "\n - schemeIdUri: " + cencElements[j].getAttribute("schemeIdUri");
                            if (!!cencElements[j] && !!cencElements[j].getAttribute("value")) {
                                msg += "\n - value: " + cencElements[j].getAttribute("value");
                            }
                        }
                    } else {
                        msg += "- ContentProtection not found.";
                    }

                    var protectionHeaderElements;
                    //DASH Widevine
                    protectionHeaderElements = getElementsByTagNameCustom(xml, "ms:laurl");
                    if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
                        msg += "\n\nWidevine LA_URL: " + protectionHeaderElements[0].getAttribute("licenseUrl");
                    } else {
                        msg += "\n- Widevine ms:laurl not found.";
                    }

                    //HLS
                    var urlHLS = getHlsUrl();
                    BrowserUtils.xhrRequest(urlHLS, "GET", "", "", "useResponse", function (text) {
                        if (!!text) {
                            var lines = text.split("\r\n");
                            for (var i = 0; i < lines.length; i++) {
                                if (lines[i].toLowerCase().indexOf("qualitylevels") > 0) {
                                    //construct 2nd layer URL
                                    var index = lines[i].toLowerCase().indexOf("qualitylevels");
                                    var qualityLevels = lines[i].substr(index, lines[i].length - index - 1);
                                    var url2 = urlHLS.substring(0, urlHLS.toLowerCase().indexOf("manifest")) + qualityLevels;
                                    console.log("Layer 2 HLS playlist URL: " + url2);

                                    BrowserUtils.xhrRequest(url2, "GET", "", "", "useResponse", function (text) {
                                        var lines = text.split("\r\n");
                                        var fps = false;  //whether FPS is applied
                                        for (var i = 0; i < lines.length; i++) {
                                            if (lines[i].substr(0, 28) == "#EXT-X-KEY:METHOD=SAMPLE-AES") {
                                                fps = true;
                                                //parse KSM, IV and KeyFormat
                                                var startIndex = lines[i].indexOf("skd:");
                                                var ksmurl = lines[i].substr(startIndex, lines[i].length - startIndex - 1);
                                                console.log("FPS LA_URL: " + ksmurl);
                                                msg += "\nFairPlay LA_URL: " + ksmurl.replace("skd:", "https:");

                                                //display final msg
                                                player.overlay.eventdiv.innerText = msg;

                                                break;   //level 2 playlist
                                            }
                                        }
                                        if (!fps) {
                                            msg += "\n- FPS not found."
                                            player.overlay.eventdiv.innerText = msg;
                                        }

                                        //DASH PlayReady
                                        //var protectionHeaderElements = xml.getElementsByTagName("mspr:pro");  //this does not work in Edge or Chrome 
                                        protectionHeaderElements = getElementsByTagNameCustom(xml, "mspr:pro");
                                        if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
                                            decodeBase64(protectionHeaderElements[0].childNodes[0].nodeValue);
                                        } else {
                                            msg += "\n- PlayReady mspr:pro not found."
                                            player.overlay.eventdiv.innerText = msg;
                                        }
                                    });

                                    break; //level 1 playlist
                                }
                            }
                        } else {
                            msg += "Check the HLS URL: " + urlHLS;
                            player.overlay.eventdiv.innerText = msg;
                        }
                    });
                } else {
                    msg += "Check the DASH URL: " + urlDASH;
                    player.overlay.eventdiv.innerText = msg;
                }
            });

            //Smooth
            //url = getSmoothUrl();
            ////for DASH+CENC case, smooth is not allowed (403)
            //try {
            //    BrowserUtils.xhrRequest(url, "GET", "", "", "useResponseXML", function (xml) {
            //        //Smooth - PlayReady protection
            //        if (!!xml) {
            //            var protectionHeaderElements = xml.getElementsByTagName("ProtectionHeader");
            //            if (!!protectionHeaderElements && protectionHeaderElements.length > 0) {
            //                for (var i = 0; i < protectionHeaderElements.length; i++) {
            //                    msg = "\nSmooth Streaming mspr:pro:";
            //                    decodeBase64(protectionHeaderElements[i].childNodes[0].nodeValue, msg);
            //                }
            //            } else {
            //                player.overlay.eventdiv.innerText += "\nSmooth stream protection header is not found."
            //            }
            //        } else {
            //            player.overlay.eventdiv.innerText += "\nSmooth streaming is not allowed."
            //        }

            //        //Smooth - AES encryption
            //    });
            //}
            //catch (e) {
            //    player.overlay.eventdiv.innerText += "\n" + e.message;
            //}

        }  //getProtectionInfo


        function ContentProtection() { };

        //MediaKeys
        ContentProtection.MediaKey_PlayReady = "com.microsoft.playready";
        ContentProtection.MediaKey_Widevine = "com.widevine.alpha";
        ContentProtection.MediaKey_ClearKey = "org.w3.clearkey";
        ContentProtection.MediaKey_Access = "com.adobe.access";
        ContentProtection.MediaKey_FairPlay = "com.apple.fairplay";





        //****************************************
        // EVENTS
        //****************************************

        function overlayEventHandler(evt) {

            //event update
            if (evt.type != amp.eventName.timeupdate) {
                events.push(evt.type);
                updateEvent(EVENTS_TO_DISPLAY);
            }

            switch (evt.type) {
                case amp.eventName.loadedmetadata:
                    //register buffer data events
                    var videoBufferData = player.videoBufferData();
                    if (videoBufferData) {
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, videoBufferDataEventHandler1);
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadfailed, videoBufferDataEventHandler1);
                        videoBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, videoBufferDataEventHandler1);
                    }
                    var audioBufferData = player.audioBufferData();
                    if (audioBufferData) {
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadcompleted, audioBufferDataEventHandler1);
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadfailed, audioBufferDataEventHandler1);
                        audioBufferData.addEventListener(amp.bufferDataEventName.downloadrequested, audioBufferDataEventHandler1);
                    }

                    //register stream events
                    registerStreamEvents();
                    break;
                case amp.eventName.playbackbitratechanged:
                    //update currentPlaybackBitrate display
                    AMPUtils.updateCurrentPlaybackBitrate(player.currentPlaybackBitrate());
                    break;
                case amp.eventName.timeupdate:
                case amp.eventName.fullscreenchange:
                    updateOverlay();
                    break;
                case amp.eventName.play:
                    streamDisplay = "\n- current tech: " + player.currentTechName() +
                        "\n- current type: " + player.currentType();
                    break;
                case amp.eventName.framerateready:
                case amp.eventName.dropframechanged:
                    //framerate plugin does not work for AES-128 protected stream
                    framerate = "\n- frame rate: " + player.frameRate().toFixed(3) +
                        "\n- time scale: " + addCommas(player.timeScale());
                    if (!!player.dropFrame()) {
                        framerate += "\n- drop frame: " + player.dropFrame();
                    }
                    break;
                case amp.eventName.error:
                    events.push(ErrorUtils.prettyPrintErrorObject(player.error()));
                    updateEvent(EVENTS_TO_DISPLAY);
                    stopEventUpdate = true;  //some browsers will not stop on error
                    break;
                default:
                    break;
            }
        }

        function registerStreamEvents() {
            //trackselected events
            var videoStreamList = player.currentVideoStreamList();
            if (!!videoStreamList && videoStreamList.streams.length > 0) {
                videoStreamList.streams[0].addEventListener(amp.streamEventName.trackselected, trackselectedHandler);
            }
        }

        //manually selected/forced bitrate, different from amp.eventName.playbackbitratechanged
        function trackselectedHandler(evt) {
            var msg = evt.type + ": selected bitrate " + player.currentPlaybackBitrate();
            events.push(msg);
        }

        function audioBufferDataEventHandler1(evt) {
            processBufferData1(evt, "audio");
        }

        function videoBufferDataEventHandler1(evt) {
            processBufferData1(evt, "video");
        }

        function processBufferData1(evt, type) {
            var bufferData;                 //holding either audio or video buffer
            var downloadSize, downloadTime; //for either audio or video
            var msg;                        //messages pushed into events array
            var url;
            var mb;

            switch (type) {
                case "audio":
                    bufferData = player.audioBufferData();
                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:
                            url = bufferData.downloadRequested.url;
                            if (url.indexOf("mediaservices.windows.net") > 0) {  //AMS source
                                url = " ... " + url.substr(url.indexOf(".net/") + 41);
                            }
                            msg = evt.type + ": " + url;
                            break;
                        case amp.bufferDataEventName.downloadcompleted:
                            if (!!bufferData && !!bufferData.downloadCompleted) {
                                downloadSize = addCommas(bufferData.downloadCompleted.totalBytes);
                                downloadTime = addCommas(bufferData.downloadCompleted.totalDownloadMs);
                                audioBufferDataDisplay = "\n- audio download size (bytes): " + downloadSize +
                                    "\n- audio download time (ms): " + downloadTime +
                                    "\n- audio buffer level (sec): " + bufferData.bufferLevel.toFixed(3);
                                if (!!bufferData.downloadCompleted && !!bufferData.downloadCompleted.measuredBandwidth) {
                                    audioBufferDataDisplay += "\n- audio measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0));
                                    //"- audio perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth);
                                }
                            }
                            msg = evt.type + ": " + type;
                            msg += ", " + downloadSize + " B in " + downloadTime + " ms";
                            break;
                        case amp.bufferDataEventName.downloadfailed:
                            //if (!!bufferData && !!bufferData.downloadFailed) {
                            //    videoBufferDataDisplay += "- download failure: code: " + bufferData.downloadFailed.code + ", message: " + bufferData.downloadFailed.message + "\n";
                            //}
                            msg = "[FAILURE] " + evt.type + ": " + type;
                            break;
                        default:
                            break;
                    }
                    break;  //audio
                default:  //video
                    bufferData = player.videoBufferData();
                    switch (evt.type) {
                        case amp.bufferDataEventName.downloadrequested:
                            url = bufferData.downloadRequested.url;
                            if (url.indexOf("mediaservices.windows.net") > 0) {  //AMS source
                                url = " ... " + url.substr(url.indexOf(".net/") + 41);
                            }
                            msg = evt.type + ": " + url;
                            break;
                        case amp.bufferDataEventName.downloadcompleted:
                            if (!!bufferData && !!bufferData.downloadCompleted) {
                                downloadSize = bufferData.downloadCompleted.totalBytes;
                                downloadTime = addCommas(bufferData.downloadCompleted.totalDownloadMs);
                                videoBufferDataDisplay = "\n- video download size (bytes): " + addCommas(downloadSize) +
                                    "\n- video download time (ms): " + downloadTime +
                                    "\n- video buffer level (sec): " + bufferData.bufferLevel.toFixed(3) +
                                    "\n- video measured bandwidth (bps): " + addCommas(bufferData.downloadCompleted.measuredBandwidth.toFixed(0)) +
                                    "\n- video perceived bandwidth (bps): " + addCommas(bufferData.perceivedBandwidth.toFixed(0));
                                //URL
                                videoBufferDataDisplay += "\n- req url: ... " + bufferData.downloadRequested.url.substr(bufferData.downloadRequested.url.length - 42);
                                //response headers
                                var responseHeaders = bufferData.downloadCompleted.responseHeaders;
                                if (!!responseHeaders && !!responseHeaders.Expires) {
                                    videoBufferDataDisplay += "\n- expires: " + responseHeaders.Expires;
                                }
                                if (!!responseHeaders && !!responseHeaders.Pragma) {
                                    videoBufferDataDisplay += "\n- pragma: " + responseHeaders.Pragma;
                                }
                            }
                            msg = evt.type + ": " + type;
                            mb = downloadSize / 1048576;
                            msg += ", [ SEGMENT SIZE: " + mb.toFixed(1) + " MB ] (" + addCommas(downloadSize) + " B) in " + downloadTime + " ms";
                            break;
                        case amp.bufferDataEventName.downloadfailed:
                            //if (!!bufferData && !!bufferData.downloadFailed) {
                            //    videoBufferDataDisplay += "- download failure: code: " + bufferData.downloadFailed.code + ", message: " + bufferData.downloadFailed.message + "\n";
                            //}
                            msg = "[FAILURE] " + evt.type + ": " + type;
                            break;
                        default:
                            break;
                    }
                    break;  //video
            }

            updateContent();
            events.push(msg);
            updateEvent(EVENTS_TO_DISPLAY);
        }


        //not yet used
        function getbuffered(amPlayer) {
            var display = "";
            var timeranges = amPlayer.buffered();
            var start, end, range;
            if (timeranges != undefined) {
                for (var i = 0; i < timeranges.length; i++) {
                    start = timeranges.start(i);
                    end = timeranges.end(i);
                    range = end - start;
                    display += "[" + start.toFixed(3) + ", " + end.toFixed(3) + "] " + range.toFixed(3);
                }
            }
            return display;
        }


        //register events to handle for diagnoverlay
        function registerOverlayEvents() {
            var events = [amp.eventName.loadstart,
            amp.eventName.durationchange,
            amp.eventName.loadeddata,
            amp.eventName.loadedmetadata,
            amp.eventName.canplaythrough,
            amp.eventName.waiting,
            amp.eventName.play,
            amp.eventName.playing,
            amp.eventName.ended,
            amp.eventName.seeking,
            amp.eventName.seeked,
            amp.eventName.pause,
            amp.eventName.volumechange,
            amp.eventName.error,
            amp.eventName.timeupdate,
            amp.eventName.playbackbitratechanged,
            amp.eventName.downloadbitratechanged,
            amp.eventName.mute,
            amp.eventName.unmute,
            amp.eventName.fullscreenchange,
            amp.eventName.exitfullscreen,
            amp.eventName.rewind,
            amp.eventName.resume,
            amp.eventName.skip,
            amp.eventName.ratechange,
            amp.eventName.firstquartile,
            amp.eventName.midpoint,
            amp.eventName.thirdquartile,
            ];

            for (var i = 0; i < events.length; i++) {
                player.addEventListener(events[i], overlayEventHandler);
            }

            //events if framerate plugin is present
            if (!!amp.eventName.framerateready) {
                events = [amp.eventName.framerateready,
                amp.eventName.dropframechanged,
                ];

                for (var i = 0; i < events.length; i++) {
                    player.addEventListener(events[i], overlayEventHandler);
                }
            }
        }



        //****************************************
        //ErrorUtils
        //****************************************
        function ErrorUtils() { };

        ErrorUtils.getErrorObject = function (error) {

            var errorCode, errorMessage, errorSource, errorCategory, detailedErrorCode, detailedErrorDescription;

            var mask_27_00 = 0x0fffffff;                   //  268435455 = 00001111111111111111111111111111   (category level error details)
            var mask_31_28 = 0xF0000000;                   // 4026531840 = 11110000000000000000000000000000   (tech source level error)


            //basic error properties
            if (error.code) {
                errorCode = error.code;
            }

            if (error.message) {
                errorMessage = error.message;
            }

            //error source/tech
            if (error.code) {
                switch (error.code & mask_31_28) {
                    case 0x00000000:
                        errorSource = "Unknow";
                        break;
                    case 0x10000000:
                        errorSource = "AMP";
                        break;
                    case 0x20000000:
                        errorSource = "AzureHtml5JS";
                        break;
                    case 0x30000000:
                        errorSource = "FlashSS";
                        break;
                    case 0x40000000:
                        errorSource = "SilverlightSS";
                        break;
                    case 0x50000000:
                        errorSource = "Html5";
                        break;
                    case 0x60000000:
                        errorSource = "Html5FairPlayHLS";
                        break;
                    default:
                        errorSource = errorCode & 0xF0000000;
                        break;
                }
            }

            //detail level error code and message
            var maskedErrorCode = errorCode & mask_27_00;  //set first 4 bits to 0000   
            var errorCodeRanges = [{ min: amp.errorCode.abortedErrStart, max: 0x01FFFFF, message: "MEDIA_ERR_ABORTED (You aborted the video playback)" },
            { min: amp.errorCode.networkErrStart, max: 0x02FFFFF, message: "MEDIA_ERR_NETWORK (A network error caused the video download to fail part-way.)" },
            { min: amp.errorCode.decodeErrStart, max: 0x03FFFFF, message: "MEDIA_ERR_DECODE (The video playback was aborted due to a corruption problem or because the video used features your browser did not support.)" },
            { min: amp.errorCode.srcErrStart, max: 0x04FFFFF, message: "MEDIA_ERR_SRC_NOT_SUPPORTED (The video could not be loaded, either because the server or network failed or because the format is not supported.)" },
            { min: amp.errorCode.encryptErrStart, max: 0x05FFFFF, message: "MEDIA_ERR_ENCRYPTED (The video is encrypted and we do not have the keys to decrypt it.)" },
            { min: amp.errorCode.srcPlayerMismatchStart, max: 0x06FFFFF, message: "SRC_PLAYER_MISMATCH (No compatible source was found for this video.)" },
            { min: amp.errorCode.errUnknown, max: 0x0, message: "MEDIA_ERR_UNKNOWN (An unknown error occurred.)" },
            ];
            var errorCodes;

            //determine detailed error
            if (maskedErrorCode >= errorCodeRanges[0].min && maskedErrorCode <= errorCodeRanges[0].max) {
                errorCategory = errorCodeRanges[0].message;
                errorCodes = [{ code: amp.errorCode.abortedErrUnknown, description: "Generic abort error" },
                { code: amp.errorCode.abortedErrNotImplemented, description: "Abort error, not implemented" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[1].min && maskedErrorCode <= errorCodeRanges[1].max) {
                errorCategory = errorCodeRanges[1].message;
                errorCodes = [{ code: amp.errorCode.networkErrUnknown, description: "Generic network error" },
                { code: amp.errorCode.networkErrHttpResponseBegin, description: "Http error response start value" },
                { code: amp.errorCode.networkErrHttpBadUrlFormat, description: "Http 400 error response" },
                { code: amp.errorCode.networkErrHttpUserAuthRequired, description: "Http 401 error response" },
                { code: amp.errorCode.networkErrHttpUserForbidden, description: "Http 403 error response" },
                { code: amp.errorCode.networkErrHttpUrlNotFound, description: "Http 404 error response" },
                { code: amp.errorCode.networkErrHttpNotAllowed, description: "Http 405 error response" },
                { code: amp.errorCode.networkErrHttpPreconditionFailed, description: "Http 412 error response" },
                { code: amp.errorCode.networkErrHttpInternalServerFailure, description: "Http 500 error response" },
                { code: amp.errorCode.networkErrHttpBadGateway, description: "Http 502 error response" },
                { code: amp.errorCode.networkErrHttpServiceUnavailable, description: "Http 503 error response" },
                { code: amp.errorCode.networkErrHttpGatewayTimeout, description: "Http 504 error response" },
                { code: amp.errorCode.networkErrHttpResponseEnd, description: "Http error response end value" },
                { code: amp.errorCode.networkErrTimeout, description: "Network timeout error" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[2].min && maskedErrorCode <= errorCodeRanges[2].max) {
                errorCategory = errorCodeRanges[2].message;
                errorCodes = [{ code: amp.errorCode.decodeErrUnknown, description: "Generic decode error" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[3].min && maskedErrorCode <= errorCodeRanges[3].max) {
                errorCategory = errorCodeRanges[3].message;
                errorCodes = [{ code: amp.errorCode.srcErrUnknown, description: "Generic source not supported error" },
                { code: amp.errorCode.srcErrParsePresentation, description: "Presentation parse error" },
                { code: amp.errorCode.srcErrParseSegment, description: "Segment parse error" },
                { code: amp.errorCode.srcErrUnsupportedPresentation, description: "Presentation not supported" },
                { code: amp.errorCode.srcErrInvalidSegment, description: "Invalid segment" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[4].min && maskedErrorCode <= errorCodeRanges[4].max) {
                errorCategory = errorCodeRanges[4].message;                                                                  //5
                errorCodes = [{ code: amp.errorCode.encryptErrUnknown, description: "Generic encrypted error" },
                { code: amp.errorCode.encryptErrDecrypterNotFound, description: "Decryptor not found" },
                { code: amp.errorCode.encryptErrDecrypterInit, description: "Decryptor initialization error" },
                { code: amp.errorCode.encryptErrDecrypterNotSupported, description: "Decryptor not supported" },
                { code: amp.errorCode.encryptErrKeyAcquire, description: "Key acquire failed" },
                { code: amp.errorCode.encryptErrDecryption, description: "Decryption of segment failed" },
                { code: amp.errorCode.encryptErrLicenseAcquire, description: "License acquire failed" },
                ];
            } else if (maskedErrorCode >= errorCodeRanges[5].min && maskedErrorCode <= errorCodeRanges[5].max) {
                errorCategory = errorCodeRanges[5].message;                                                                                     //6
                errorCodes = [{ code: amp.errorCode.srcPlayerMismatchUnknown, description: "Generic no matching tech player to play the source" },
                { code: amp.errorCode.srcPlayerMismatchFlashNotInstalled, description: "Flash plugin is not installed, if installed the source may play. Note: If 0x00600003, both Flash and Silverlight are not installed, if specified in the techOrder." },
                { code: amp.errorCode.srcPlayerMismatchSilverlightNotInstalled, description: "Silverlight plugin is not installed, if installed the source may play. Note: If 0x00600003, both Flash and Silverlight are not installed, if specified in the techOrder." },
                { code: 0x00600003, description: "Both Flash and Silverlight are not installed, if specified in the techOrder." },
                ];
            } else {
                errorCategory = errorCodeRanges[6].message;                                                                                                           //0xFF
                errorCodes = [{ code: amp.errorCode.errUnknown, description: "Unknown errors" },
                ];
            }

            //detailed error code and description
            for (var i = 0; i < errorCodes.length; i++) {
                if (maskedErrorCode == errorCodes[i].code) {
                    detailedErrorCode = errorCodes[i].code;
                    detailedErrorDescription = errorCodes[i].description;
                    break;
                }
            }

            //error info container
            var errorObject = {
                code: errorCode,
                message: errorMessage,
                source: errorSource,
                categoryCode: errorCodes[0].code,
                categoryMessage: errorCategory,
                detailedCode: detailedErrorCode,
                detailedDescription: detailedErrorDescription,
            };

            return errorObject;
        };

        ErrorUtils.prettyPrintErrorObject = function (error) {
            //get errorObject container
            var errorObject = ErrorUtils.getErrorObject(error);
            var msg = "Error info:";

            msg += "\n- error message: " + errorObject.message;
            msg += "\n- error source: " + errorObject.source;
            if (!!errorObject.code) {
                msg += "\n- error code: " + errorObject.code.toString(16);
            }
            if (!!errorObject.categoryCode) {
                msg += "\n- category code: " + errorObject.categoryCode.toString(16);
            }
            msg += "\n- category message: " + errorObject.categoryMessage;
            if (!!errorObject.detailedCode) {
                msg += "\n- detaild code: " + errorObject.detailedCode.toString(16);
            }
            msg += "\n- detailed description: " + errorObject.detailedDescription;

            return msg;
        };



        //****************************************
        // FORMATTING
        //****************************************

        //add commas to an integer number in string format. It will handle whole numbers or decimal numbers. You can pass it either a number or a string.
        function addCommas(str) {
            var output = str;
            if (str) {
                var parts = (str + "").split("."),
                    main = parts[0],
                    len = main.length,
                    i = len - 1;
                output = "";

                while (i >= 0) {
                    output = main.charAt(i) + output;
                    if ((len - i) % 3 === 0 && i > 0) {
                        output = "," + output;
                    }
                    --i;
                }
                // put decimal part back
                if (parts.length > 1) {
                    output += "." + parts[1];
                }
            }
            return output;
        }

        //get wall clock in pretty format
        function getWallClock() {
            var now = new Date();
            var clock = now.getHours() + ":" +
                prettyPrintNum(now.getMinutes()) + ":" +
                prettyPrintNum(now.getSeconds()) + "." +
                prettyPrintNum(now.getMilliseconds());
            return clock;
        }

        function prettyPrintNum(number) {
            return ((number < 10) ? "0" : "") + number;
        }




        //****************************************
        //TimeUtils
        //****************************************
        function TimeUtils() { }

        TimeUtils.getEpochStartUtc = function () {
            var epoch = new Date();
            epoch.setUTCFullYear(1970);
            epoch.setUTCMonth(0);
            epoch.setUTCDate(1);
            epoch.setUTCHours(0);
            epoch.setUTCMinutes(0);
            epoch.setUTCSeconds(0);
            epoch.setUTCMilliseconds(0);
            return epoch;
        };

        TimeUtils.utcToHns = function (utc) {
            var millseconds = Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds(), utc.getUTCMilliseconds());
            var hns = millseconds * 10000
            return hns;
        };

        TimeUtils.hnsToUtc = function (hns) {
            var milliseconds = hns / 10000;
            return new Date(milliseconds);
        };


        TimeUtils.get1904EpochStartUtc = function () {
            var epoch = new Date();
            epoch.setUTCFullYear(1904);
            epoch.setUTCMonth(0);
            epoch.setUTCDate(1);
            epoch.setUTCHours(0);
            epoch.setUTCMinutes(0);
            epoch.setUTCSeconds(0);
            epoch.setUTCMilliseconds(0);
            return epoch;
        };

        TimeUtils.secondsSince1904ToLocalTime = function(seconds) {
            var date = TimeUtils.get1904EpochStartUtc();
            return date.setSeconds(date.getSeconds() + seconds);
        };



    });
}(window.amp));
