    // =========================================================================
    // TextLogManager — 로그 데이터 관리
    // =========================================================================
    var TextLogManager = {
        _list: [],
        _lineSum: 0,

        // 항목 추가 (최대 라인 초과 시 오래된 것 삭제)
        add: function (entry) {
            this._list.push(entry);
            this._lineSum += entry.lc;
            while (this._lineSum > MAX_LINES && this._list.length > 1) {
                this._lineSum -= this._list.shift().lc;
            }
        },

        list:  function () { return this._list; },
        clear: function () { this._list = []; this._lineSum = 0; },

        save: function () {
            return { list: this._list, sum: this._lineSum };
        },
        load: function (d) {
            if (d) { this._list = d.list || []; this._lineSum = d.sum || 0; }
        }
    };

