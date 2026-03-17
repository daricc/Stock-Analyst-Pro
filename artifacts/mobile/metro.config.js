const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/\.cache\/openid-client\/.*/, /node_modules\/.*_tmp_\d+\/.*/];
module.exports = config;
