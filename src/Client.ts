import * as axios   from 'axios';

import * as Auth    from './auth';
import {
    Skill,
    Flow,
    Agent,
    Project,
}                   from './Types';
import Cli          from './Cli';

export default class Client {
    constructor( public client:axios.AxiosInstance ) {
    }
    async listProjects() {
        const r = await this.client.get(`/api/v1/designer/projects`);
        return r.data as Project[];
    }
    async listAgents( project_id ) {
        const r = await this.client.get(`/api/v1/bff/agents/list`, { params: { project_id } });
        return r.data as Agent[];
    }
    async getProject( project_id ) {
        const r = await this.client.get(`/api/v1/designer/projects/by-id/${project_id}`);
        return r.data;
    }
    async listFlowSkills(flowId) {
        const r = await this.client.get(`/api/v1/designer/flows/${flowId}/skills`);
        return r.data as Skill[];
    }
    async getSkill(skillId) {
        const r = await this.client.get(`/api/v1/designer/skills/${skillId}`);
        return r.data as Skill;
    }
    async updateSkill(skillObject) {
        await this.client.put(`/api/v1/designer/flows/skills/${skillObject.id}`, skillObject);
    }
    async listFlowEvents(flowId) {
        const r = await this.client.get(`/api/v1/designer/flows/${flowId}/events`);
        return r.data;
    }
    async listFlowStates(flowId) {
        const r = await this.client.get(`/api/v1/designer/flows/${flowId}/states`);
        return r.data;
    }
    async importAkbArticle(articleData) {
        const r = await this.client.post('/api/v1/akb/append-manual', articleData);
        return r.data;
    }
}

export const get = async ( cli:Cli ) => {
    let accessToken = await Auth.getValidAccessToken(cli);
    cli.log(2, `✓ Access token obtained`);
    const client = axios.default.create({
        baseURL: cli.base_url,
        headers: { accept: 'application/json' }
    });
    client.interceptors.request.use(async (config) => {
        // @ts-expect-error
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
        if (cli.log_level>2 ) {
            cli.log(2, `→ ${config.method?.toUpperCase()} ${config.url}`);
            if (config.data)
                cli.log(2, '  Data:', JSON.stringify(config.data, null, 2));
            if (config.params) cli.log(1, '  Params:', config.params);
        }
        return config;
    });
    let retried = false;
    client.interceptors.response.use(
        ( r ) => {
            if( cli.log_level>2 ) {
                cli.log(1, `← ${r.status} ${r.config.method?.toUpperCase()} ${r.config.url}`);
                if (r.data && Object.keys(r.data).length < 20) {
                    cli.log(1, '  Response:', JSON.stringify(r.data, null, 2));
                } else if (r.data) {
                    cli.log(1, `  Response: [${typeof r.data}] ${Array.isArray(r.data) ? r.data.length + ' items' : 'large object'}`);
                }
            }
            return r;
        },
        async (error) => {
            const status = error?.response?.status;
            if( cli.log_level>2 ) {
                cli.log(1, `← ${status} ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
                if (error.response?.data) 
                    cli.log(1, '  Error data:', error.response.data);
            }
            if( status === 401 && !retried ) {
                retried = true;
                cli.log(2, '🔄 Retrying with fresh token...');
                accessToken = await Auth.forceReauth();
                error.config.headers.Authorization = `Bearer ${accessToken}`;
                return client.request(error.config);
            }
            throw error;
        }
    );
    return new Client(client);
}
