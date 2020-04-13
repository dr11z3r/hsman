var fs = require('fs');
var config = null;

const defaults = {
    port: 8080,
    tickInterval: 60,
    defaultAction: 'replace',
    sign: false,
    logLevel: 'info',
    service: {
        enabled: true,
        port: 29103,
        authentication: {
            required: false,
            mode: 'cookie',
        },
    },
    pool: {
        vanguards: {
            enabled: false,
            cmd: ['vanguards/src/vanguards.py', ['--control_port', '%control_port%']],
        },
        v3Instances: 5,
        v2Instances: 0,
        servicesPerInstance: 1,
    },
    behaviours: {
        highCpuUsage: {
            enabled: true,
            action: 'default',
            usageThreshold: 90,
            minTicks: 0,
        },
        unresponsive: {
            enabled: true,
            action: ['restart', 'replace'],
            minTicks: 3,
        },
        uptime: {
            enabled: false,
            action: 'restart',
            minTicks: 2880,
        },
    },
};

module.exports.getConfig = function getConfig() {
    if (!config) {
        try {
            config = JSON.parse(fs.readFileSync('config.json'));
        } catch (e) {
            if (!fs.existsSync('config.json')) {
                fs.writeFileSync('config.json', JSON.stringify(defaults, null, '\t'));
                config = defaults;
            } else console.log('Error loading config file. %s', e.stack);
        }
    }
    return config;
}