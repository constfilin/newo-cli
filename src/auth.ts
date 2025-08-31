import fs from 'fs-extra';
import * as axios from 'axios';

import Cli from './Cli';

const saveTokens = async (cli: Cli, tokens) => {
    await fs.ensureDir(cli.state_dir);
    await fs.writeJson(cli.tokens_path, tokens, { spaces: 2 });
}

const loadTokens = async (cli: Cli) => {
    if( await fs.pathExists(cli.tokens_path) )
        return fs.readJson(cli.tokens_path);
    if (cli.access_token || cli.refresh_token) {
        const t = {
            access_token    : cli.access_token || '',
            refresh_token   : cli.refresh_token || '',
            expires_at      : Date.now() + 10 * 60 * 1000
        };
        await saveTokens(cli,t);
        return t;
    }
    return null;
}

const isExpired = (tokens) => {
    if( !tokens?.expires_at ) 
        return false;
    return Date.now() >= tokens.expires_at - 10_000;
}

const exchangeApiKeyForToken = async ( cli:Cli ) => {
    if( !cli.api_key ) 
        throw new Error('NEWO_API_KEY not set. Provide an API key in .env');
    const url = `${cli.base_url}/api/v1/auth/api-key/token`;
    const res = await axios.default.post(url, {}, { headers: { 'x-api-key': cli.api_key, 'accept': 'application/json' } });
    const data = res.data || {};
    const access = data.access_token || data.token || data.accessToken;
    const refresh = data.refresh_token || data.refreshToken || '';
    const expiresInSec = data.expires_in || data.expiresIn || 3600;
    const tokens = { access_token: access, refresh_token: refresh, expires_at: Date.now() + expiresInSec * 1000 };
    await saveTokens(cli,tokens);
    return tokens;
}

const refreshWithEndpoint = async( cli:Cli, refreshToken: boolean ) => {
    if( !cli.refresh_token )
        throw new Error('NEWO_REFRESH_URL not set');
    const res = await axios.default.post(cli.refresh_token, { refresh_token: refreshToken }, { headers: { 'accept': 'application/json' } });
    const data = res.data || {};
    const access = data.access_token || data.token || data.accessToken;
    const refresh = data.refresh_token ?? refreshToken;
    const expiresInSec = data.expires_in || 3600;
    const tokens = { access_token: access, refresh_token: refresh, expires_at: Date.now() + expiresInSec * 1000 };
    await saveTokens(cli,tokens);
    return tokens;
}

export const getValidAccessToken = async ( cli:Cli ) => {
    let tokens = await loadTokens(cli);
    if (!tokens || !tokens.access_token) {
        tokens = await exchangeApiKeyForToken(cli);
        return tokens.access_token;
    }
    if (!isExpired(tokens))
        return tokens.access_token;

    if( cli.refresh_url && tokens.refresh_token ) {
        tokens = await refreshWithEndpoint(cli,tokens.refresh_token);
        return tokens.access_token;
    }
    tokens = await exchangeApiKeyForToken(cli);
    return tokens.access_token;
}

export const forceReauth = async ( cli:Cli ) => {
    const tokens = await exchangeApiKeyForToken(cli);
    return tokens.access_token;
}
