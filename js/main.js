/**
 * NGEx のあぼーんデータを表す.
 * Object.create(NGExData); によって新規作成すること.
 */
var NGExData = {
    /**
     * タイトル
     * @type {String}
     * @required
     */
    title: '',

    /**
     * あぼーんの対象
     * @type {String}
     * @note 'post' (レス), 'thread' (スレッド) の2通りのみが可
     * @required
     */
    target: 'post',

    /**
     * マッチの方法
     * @type {String}
     * @note 'any' (いづれか), 'all' (全て) の2通りのみが可
     * @required
     */
    match: 'all',

    /**
     * 連鎖あぼーんをするかどうか
     * @type {Boolean|undefined}
     * @note true: する, false: しない, undefined: デフォルトの設定に従う
     */
    chain: undefined,

    /**
     * 透明あぼーんをするかどうか
     * @type {Boolean|undefined}
     * @note true: する, false: しない, undefined: デフォルトの設定に従う
     */
    hide: undefined,

    /**
     * 有効期限
     * @type {Number|undefined}
     * @note UNIX時間を設定する. undefined の場合は期限なしを表す.
     */
    expire: undefined,

    /**
     * 自動NGIDをするかどうか
     * @type {Boolean}
     * @note true: する, false: しない
     */
    autoNGID: false,

    /**
     * あぼーんせずにハイライトするかどうか
     * @type {Boolean}
     * @note true: する, false: しない
     */
    highlight: false,


    /**
     * マッチする条件
     * @type {Object} rule
     *       {String} rule.target 条件の対象 'name', 'msg' など.
     *                            詳細は abone-manager-ngex.xul の menulist.rule-target を参照.
     *       {Boolean} rule.regexp 正規表現かどうか
     *       {Boolean} rule.ignoreCase 大文字小文字を無視するかどうか
     *       {String} rule.query NGワード
     *       {String} rule.condition マッチの方法
     *                               'contains': 含む, 'notContain': 含まない
     *                               'equals': である(一致する), 'notEqual': でない(一致しない)
     *                               'startsWith': で始まる, 'endsWith': で終わる
     */
    rules: [],
};


var NGadv = {
    validate: function(line){
        try{
            return (typeof JSON.parse(line).title) === 'string';
        }catch(ex){
            return false;
        }
    },

    convert: function(line){
        let ngadv;

        try{
            ngadv = JSON.parse(line);
        }catch(ex){
            throw new Error('不正な形式です: ' + line);
        }

        let ngex = Object.create(NGExData);

        // タイトル
        ngex.title = ngadv.title;

        //対象
        switch(ngadv.targetType){
            case 'RES':
                ngex.target = 'post';
                break;

            case 'THREAD':
                ngex.target = 'thread';
                break;

            default:
                throw new Error(ngadv.title + ' には不正な対象が設定されています: ' + ngadv.targetType);
        }

        //有効期限
        ngex.expire = ngadv.expire;

        //透明あぼーん
        ngex.hide = ngadv.hide;

        //連鎖あぼーん
        ngex.chain = ngadv.chain;

        //自動NGID
        ngex.autoNGID = ngadv.autoNGID;

        //マッチの方法
        ngex.match = ngadv.conditions.some((condition) => condition.andor === 'OR') ? 'any' : 'all';

        // ルール
        ngex.rules = ngadv.conditions.map((condition) => {
            let rule = {};

            //対象
            switch(condition.type){
                case 'NAME':
                case 'MAIL':
                case 'DATE':
                case 'IP':
                case 'HOST':
                case 'ID':
                    rule.target = condition.type.toLowerCase();
                    break;

                case 'BEID':
                    rule.target = 'be';
                    break;

                case 'BEBASEID':
                    rule.target = 'baseBe';
                    break;

                case 'RES':
                    rule.target = 'msg';
                    break;

                case 'THREAD':
                    rule.target = 'title';
                    break;

                case 'BOARD':
                    rule.target = 'board_url';
                    break;

                case 'THREAD_URL':
                    rule.target = 'thread_url';
                    break;

                default:
                    console.warn(ngadv.title + ' には不明な対象がセットされた条件があります.' +
                                 'この条件は無視されました: ' + condition.type);
                    return null;
            }

            switch(condition.condStr){
                case '!==':
                    rule.condition = 'contains';
                    break;

                case '===':
                    rule.condition = 'notContain';
                    break;

                case 'ALL_EQUAL':
                    rule.condition = 'equals';
                    break;

                case 'NOT_EQUAL':
                    rule.condition = 'notEqual';
                    break;

                default:
                    console.warn(ngadv.title + ' には不明なマッチの方法がセットされた条件があります.' +
                                 'この条件は無視されました: ' + condition.condStr);
                    return null;
            }

            // 大文字小文字を無視するかどうか
            rule.ignoreCase = condition.ignoreCase;

            // 正規表現かどうか
            rule.regexp = condition.strType === 'REG';

            // 条件文字列
            rule.query = convertLegacyBR(condition.str);

            return rule;
        }).filter((item) => item !== null);

        // 「または」が含まれる場合の警告
        if(ngex.match === 'any'){
            console.warn(ngadv.title + ' は以下の理由により正しく変換されていない可能性があります:\n' +
                         '元の条件に「または」が含まれていたので, 「以下のいづれかの条件に一致する」というルールに変換されました.\n' +
                         '関連情報として http://anago.2ch.net/test/read.cgi/software/1403350012/72 もご参照下さい.' +
                         '\n\n変換前:', ngadv, '\n変換後:', ngex);
        }

        return ngex;
    }
};

var NGex = {
    validate: function(line){
        return line.startsWith('Ex:');
    },

    convert: function(line){
        let _line = line.replace(/^\w+:/, '');
        let ngex = Object.create(NGExData);

        ngex.target = 'post';
        ngex.match = 'all';
        ngex.rules = [];

        ['!', '#', 'a', 'b', 'i', 'n', 't', 'u', 'w'].forEach((tag) => {
            let tagReg = new RegExp('<(' + tag + ')>(.*?)</' + tag + '>', 'i');

            _line = _line.replace(tagReg, (_str, _tag, _content) => {
                switch(tag){

                    // 重要レス
                    case '!':
                        if(_content === '4'){
                            ngex.highlight = true;
                        }
                        break;

                    // タイトル
                    case '#':
                        ngex.title = _content;
                        break;

                    // 条件
                    default:
                        let rule = {};
                        let invertCondition = _tag !== tag;

                        rule.ignoreCase = true;

                        // 対象
                        switch(tag){
                            case 'a':
                                rule.target = 'mail';
                                break;

                            case 'b':
                                rule.target = 'be';
                                break;

                            case 'i':
                                rule.target = 'id';
                                break;

                            case 'n':
                                rule.target = 'name';
                                break;

                            case 't':
                                rule.target = 'title';
                                break;

                            case 'u':
                                rule.target = 'thread_url';
                                break;

                            case 'w':
                                rule.target = 'msg';
                                break;
                        }

                        // 正規表現
                        _content = _content.replace(/^\/(.*)\/([gimy]?)$/, (_str, _regexp, _flag) => {
                            rule.regexp = true;
                            rule.ignoreCase = (!!_flag) && _flag.contains('i');

                            return _regexp;
                        });

                        // 完全一致
                        if(!rule.regexp){
                            _content = _content.replace(/^'(.*)'$/, '"$1"');
                            _content = _content.replace(/^"(.*)"$/, (_str, __content) => {
                                rule.ignoreCase = false;
                                rule.condition = !invertCondition ? 'equals' : 'notEqual';

                                return __content;
                            });
                        }

                        if(!rule.condition){
                            rule.condition = !invertCondition ? 'contains': 'notContain';
                        }

                        rule.query = convertLegacyBR(_content);

                        ngex.rules.push(rule);

                        break;
                }

                return '';
            });
        });

        if(_line.length !== 0){
            console.warn((ngex.title || line) + ' には不明な条件が設定されています.' +
                         'この条件は無視されました: ' + _line);
        }

        if(!ngex.title){
            ngex.title = line;
        }

        return ngex;
    }
};

var NGthreads = {
    validate: function(line){
        return line.startsWith('T:');
    },

    convert: function(line){
        let ngex = NGex.convert(line);
        ngex.target = 'thread';

        return ngex;
    }
};

var NGid2 = {
    validate: function(line){
        return /\t - \t/.test(line) || /^[0-9A-Za-z\+\/!]+$/.test(line);
    },

    //abcdefghi  -  Sun Jun 17 2012 00:00:00 GMT+0900
    //（[ID][タブ][半角スペース]-[半角スペース][タブ][日時]）
    convert: function(line){
        if(!line.contains(' ')){
            // 通常の NGID
            return {
                title: 'NGID: ' + line,
                target: 'post',
                match: 'all',
                rules: [{
                    target: 'id',
                    query: line,
                    condition: 'equals'
                }]
            };
        }else{
            // 期限付き NGID
            let [id, expire] = line.split(/\t - \t/);

            if(!id || !expire){
                throw new Error('不正な形式です: ' + line);
            }

            expire = Date.parse(expire);

            if(!expire){
                throw new Error('日付の形式が不正です: ' + line);
            }

            return {
                title: 'NGID: ' + id,
                target: 'post',
                match: 'all',
                expire: expire,
                rules: [{
                    target: 'id',
                    query: id,
                    condition: 'equals'
                }]
            };
        }
    }

};


function convertLegacyBR(legacyQuery){
    let query = legacyQuery.replace(/<br(?:\\s| )?[\+\*]?\\?\/>/g, '<br>');

    if(legacyQuery !== query){
        console.info('改行に関する chaika 1.6.3 以前向けの記述を変換しました.' +
                     '\n\n変換前:' + legacyQuery + '\n変換後:' + query);
    }

    if(/(?:<br[^>]|\\r|\\n)/.test(query)){
        console.warn('改行が適切に記述されていない恐れがあります.' +
                     'chaika 1.7.0 以降では改行は <br> と記述して下さい: ' + query);
    }

    return query;
}


function readFileContent(file){
    return new Promise((resolve, reject) => {
        console.log(file.name + ' を読み込んでいます...');

        if(['NGex.txt', 'NGthreads.txt', 'NGadv.txt', 'NGid2.txt'].indexOf(file.name) === -1){
            console.warn('対象外のファイルを指定している可能性があります.', file.name);
        }

        let reader = new FileReader();

        reader.onload = function(e){
            resolve(e.target.result);
        };

        reader.onerror = function(e){
            console.error('読み込みに失敗しました.', e.target.error);
            reject(e.target.error);
        };

        reader.readAsText(file, 'Shift_JIS');
    });
}


function fetchFilesContent(){
    let fileNodes = document.querySelectorAll('input[type="file"]');
    let content = '';

    return Array.slice(fileNodes).reduce((promise, node) => {
        return promise.then(() => {
            if(!node.files || !node.files[0]) return content;

            return readFileContent(node.files[0]).then((_content) => { content += _content + '\n\n'; });
        });
    }, Promise.resolve()).then(() => content);
}


function convert(){
    console.time('Processing time');

    fetchFilesContent().then((data) => {
        if(!data) return;

        let result = data.split(/[\n\r]+/).map((line, index) => {
            if(!line) return;

            let ngex;

            format = ['NGadv', 'NGex', 'NGthreads', 'NGid2'].find((_fmt) => {
                return window[_fmt].validate(line);
            });

            if(!format){
                console.error('不明なフォーマットです:', line);
            }else{
                try{
                    ngex = window[format].convert(line);
                }catch(ex){
                    console.error('変換中にエラーが発生しました. このルールは無視されます.', ex);
                }
            }

            return JSON.stringify(ngex);
        }).filter((item) => !!item);

        result = result.join('\n');


        let blob = new Blob([result], { type: 'text/plain' });
        let downloadBtn = document.getElementById('downloadBtn');

        downloadBtn.setAttribute('download', 'NGEx.txt');
        downloadBtn.setAttribute('href', window.URL.createObjectURL(blob));

        document.getElementById('result').value = result;

        console.log('全ての変換が終了しました.');
        console.timeEnd('Processing time');
    }).catch((ex) => {
        console.error(ex);
    });
}
