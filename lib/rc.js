module.exports.textToRC = function (raw) {
    if (!raw) return {};
    var obj = {};
    raw.split(/\n/).forEach(ln => {
        ln = ln.replace(/\r/g, '');
        var v = ln.indexOf(' ');
        if (v !== -1) {
            if (obj[ln.substr(0, v)]) {
                if (typeof obj[ln.substr(0, v)] === 'string') {
                    obj[ln.substr(0, v)] = [
                        obj[ln.substr(0, v)],
                        ln.substr(v + 1),
                    ];
                } else {
                    obj[ln.substr(0, v)].push(ln.substr(v + 1));
                }
            } else {
                obj[ln.substr(0, v)] = ln.substr(v + 1);
            }
        }
    });
    return obj;
}
// tslint:disable-next-line: function-name
module.exports.RCToText = function (obj) {
    if (!obj) return '';
    var contents = '';
    for (var k in obj) {
        if (typeof obj[k] !== 'string') {
            for (let t of obj[k]) {
                contents += `${k} ${t}\n`;
            }
        } else {
            contents += `${k} ${obj[k]}\n`;
        }
    }
    return contents;
}