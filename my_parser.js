(function () {
    'use strict';

    if (window.my_parser_plugin_ready) return;
    window.my_parser_plugin_ready = true;

    function bytesToSize(bytes) {
        if (!bytes) return '0 B';
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0) + ' ' + sizes[i];
    }

    function detectQuality(title) {
        title = (title || '').toLowerCase();
        if (/2160p|4k|uhd/.test(title)) return 2160;
        if (/1080p|fullhd|full hd/.test(title)) return 1080;
        if (/720p/.test(title)) return 720;
        if (/480p|dvdrip/.test(title)) return 480;
        return 0;
    }

    function normalize(item) {
        var title = item.Title || '';
        var size = item.Size || 0;
        var date = item.PublishDate ? new Date(item.PublishDate) : null;
        var quality = detectQuality(title);

        return {
            // формат Jackett
            Title: title,
            Tracker: item.Tracker || '',
            Size: size,
            PublishDate: item.PublishDate || '',
            Seeders: item.Seeders || 0,
            Peers: item.Peers || 0,
            MagnetUri: item.MagnetUri || '',
            Link: item.Link || '',
            // внутренний формат Lampa
            title: title,
            tracker: item.Tracker || '',
            size: size,
            sizeName: bytesToSize(size),
            time: date ? date.getTime() : 0,
            date: date ? date.toLocaleDateString() : '',
            seeders: item.Seeders || 0,
            peers: item.Peers || 0,
            magnet: item.MagnetUri || '',
            link: item.Link || '',
            quality: quality,
            info: {
                quality: quality,
                voices: [],
                seasons: [],
                videotype: ''
            }
        };
    }

    function start() {
        // ---------- Настройки ----------
        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'my_parser_url', type: 'input', default: '' },
            field: {
                name: 'My Parser: адрес',
                description: 'Например http://192.168.1.10:9117'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'my_parser_key', type: 'input', default: '' },
            field: {
                name: 'My Parser: API-ключ',
                description: 'Ключ из Jackett / Prowlarr'
            }
        });

        // ---------- Подмена парсера ----------
        var originalGet = Lampa.Parser.get;

        Lampa.Parser.get = function (params, oncomplete, onerror) {
            var url = (Lampa.Storage.get('my_parser_url', '') + '').replace(/\/+$/, '');
            var key = Lampa.Storage.get('my_parser_key', '') + '';

            // Если плагин не настроен — работает штатный парсер
            if (!url || !key) return originalGet.apply(this, arguments);

            var network = new Lampa.Reguest();
            var query = params.search || '';

            var request = url + '/api/v2.0/indexers/all/results' +
                '?apikey=' + encodeURIComponent(key) +
                '&Query=' + encodeURIComponent(query);

            network.timeout(30000);
            network.silent(request, function (json) {
                var results = (json && json.Results) ? json.Results : [];

                results = results
                    .filter(function (r) { return r.MagnetUri || r.Link; })
                    .map(normalize)
                    .sort(function (a, b) { return b.seeders - a.seeders; });

                oncomplete({ Results: results });
            }, function (err) {
                Lampa.Noty.show('My Parser: ошибка запроса');
                if (onerror) onerror(err);
            });
        };
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
