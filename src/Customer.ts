import path         from 'node:path';
import fs           from 'node:fs';
import fsExtra      from 'fs-extra';
import jsYaml       from 'js-yaml';
import * as axios   from 'axios';

import config   from './Config';
import Client   from './Client';
import {
    Project,
    ProjectBase
}               from './Types';

export default class Customer {

    private path            : string;
    private tokens_path     : string;
    private access_token?   : string;
    private refresh_token?  : string;
    private refresh_url?    : string;

    public  api_key         : string;
    public  client?         : Client;
    public  projectBaseById?: Record<string,ProjectBase>;
    public  projectById?    : Record<string,Project>;
    public  profile?        : Record<string,any>;

    // private
    private async saveTokens( tokens:Record<string,any> ) {
        config.log(1,`Saving tokens to ${this.tokens_path}`);
        await fsExtra.writeJson(this.tokens_path,tokens,{ spaces: 2 });
    }
    private async loadTokens() {
        if( await fsExtra.pathExists(this.tokens_path) )
            return fsExtra.readJson(this.tokens_path);
        if( this.access_token || this.refresh_token ) {
            const tokens = {
                access_token    : this.access_token || '',
                refresh_token   : this.refresh_token || '',
                expires_at      : Date.now() + 10 * 60 * 1000
            };
            await this.saveTokens(tokens);
            return tokens;
        }
        return null;
    }
    private isExpired( tokens:Record<string,any> ) {
        if( !tokens?.expires_at )
            return false;
        return Date.now() >= tokens.expires_at - 10_000;
    }
    private async exchangeApiKeyForToken() {
        const url       = `${config.base_url}/api/v1/auth/api-key/token`;
        const res       = await axios.default.post(url, {}, { headers: { 'x-api-key': this.api_key, 'accept': 'application/json' } });
        const data      = res.data || {};
        const access    = data.access_token || data.token || data.accessToken;
        const refresh   = data.refresh_token || data.refreshToken || '';
        const expiresInSec = data.expires_in || data.expiresIn || 3600;
        const tokens    = {
            access_token    : access,
            refresh_token   : refresh,
            expires_at      : Date.now() + expiresInSec * 1000
        };
        await this.saveTokens(tokens);
        return tokens;
    }
    private async getValidAccessToken() {
        try {
            let tokens = await this.loadTokens();
            if( !tokens || !tokens.access_token ) {
                tokens = await this.exchangeApiKeyForToken();
                return tokens.access_token;
            }
            if( !this.isExpired(tokens) )
                return tokens.access_token;
            if( this.refresh_url && tokens.refresh_token ) {
                tokens = await this.refreshWithEndpoint(tokens.refresh_token);
                return tokens.access_token;
            }
            tokens = await this.exchangeApiKeyForToken();
            return tokens.access_token;
        }
        catch(e:any) {
            throw Error(`Error obtaining access token: ${e.message}`);
        }
    }
    private async refreshWithEndpoint( refreshToken: boolean ) {
        if( !this.refresh_token )
            throw new Error('NEWO_REFRESH_URL not set');
        const res = await axios.default.post(this.refresh_token, { refresh_token: refreshToken }, { headers: { 'accept': 'application/json' } });
        const data = res.data || {};
        const access = data.access_token || data.token || data.accessToken;
        const refresh = data.refresh_token ?? refreshToken;
        const expiresInSec = data.expires_in || 3600;
        const tokens = { access_token: access, refresh_token: refresh, expires_at: Date.now() + expiresInSec * 1000 };
        await this.saveTokens(tokens);
        return tokens;
    }
    private async forceReauth() {
        const tokens = await this.exchangeApiKeyForToken();
        return tokens.access_token;
    }
    private async pullProject( project:Project ) {
        config.log(1,`Pulling project ${project.title} (${project.idn})`);
        const projectPath = path.join(this.path,project.idn);
        fs.mkdirSync(projectPath,{ recursive: true });
        const writeMetadata = () => {
            const base = this.projectBaseById?.[project.id];
            if( !base )
               throw new Error(`Project base not found for project ID ${project.id}`);
            return fsExtra.writeJson(path.join(projectPath,'metadata.json'),base,{ spaces: 2 });
        }
        const writeSkills = () => {
            return Promise.all(project.agents.flatMap( a => {
                //console.log(2,`Processing agent`,a);
                a.flows.flatMap( f =>
                    f.skills.map( s => {
                        const extension = s.runner_type === 'nsl' ? '.jinja' : '.guidance';
                        const skillPath = path.join(projectPath,a.idn,f.idn);
                        fs.mkdirSync(skillPath,{ recursive: true });
                        return fs.writeFileSync(path.join(skillPath,`${s.idn}${extension}`),s.prompt_script||'');
                    })
                )
            }));
        }
        const writeFlowsYaml = () => {
            const flowsData = {
                flows: project.agents.flatMap( a => {
                    return {
                        agent_idn           : a.idn,
                        agent_description   : a.description,
                        agent_flows         : a.flows.map( f => {
                            return {
                                idn                     : f.idn,
                                title                   : f.title,
                                description             : f.description||null,
                                default_runner_type     : `!enum "RunnerType.${f.default_runner_type}"`,
                                default_provider_idn    : f.default_model.provider_idn,
                                default_model_idn       : f.default_model.model_idn,
                                skills                  : (f.skills||[]).map( s => {
                                    return {
                                        idn             : s.idn,
                                        title           : s.title   ,
                                        prompt_script   : `flows/${f.idn}/${s.idn}.${s.runner_type === 'nsl' ? 'jinja' : 'nsl'}`,
                                        runner_type     : `!enum "RunnerType.${s.runner_type}"`,
                                        model           : {
                                            model_idn   : s.model?.model_idn||null,
                                            provider_idn: s.model?.provider_idn||null
                                        },
                                        parameters      : (s.parameters||[]).map( p => {
                                            return {
                                                name            : p.name,
                                                default_value   : p.default_value||'',
                                            };
                                        }),
                                    };
                                }),
                                events                  : (f.events||[]).map( e => {
                                    return {
                                        title           : e.description,
                                        idn             : e.idn,
                                        skill_selector  : `!enum "SkillSelector.${e.skill_selector}"`,
                                        skill_idn       : e.skill_idn,
                                        state_idn       : e.state_idn||null,
                                        integration_idn : e.integration_idn||null,
                                        connector_idn   : e.connector_idn||null,
                                        interrupt_mode  : `!enum "InterruptMode.${e.interrupt_mode}"`,
                                    };
                                }),
                                state_fields            : (f.states||[]).map( s => {
                                    return {
                                        title           : s.title||null,
                                        idn             : s.idn,
                                        default_value   : s.default_value||null,
                                        scope           : `!enum "StateFieldScope.${s.scope}"`,
                                    }
                                })
                            };
                        })
                    };
                })
            };
            const yamlContent = jsYaml.dump(flowsData, {
                indent      : 2,
                lineWidth   : -1,
                noRefs      : true,
                sortKeys    : false,
                quotingType : '"',
                forceQuotes : false
            }).replace(/"(!enum "[^"]+")"/g,'$1');
            return fsExtra.writeFile(path.join(projectPath,'flows.yaml'),yamlContent);
        }
        return Promise.all([
            writeMetadata(),
            writeSkills(),
            writeFlowsYaml()
        ]).then( () => {
            return project;
        });
    }
    // public
    constructor( api_key:string, path:string, tokens_path:string ) {
        if( !api_key )
            throw new Error('NEWO_API_KEY not set. Provide an API key in .env');
        this.api_key     = api_key;
        this.path        = path;
        this.tokens_path = tokens_path;
    }
    async getClient() : Promise<Client> {
        if( this.client )
            return this.client;
        let accessToken = await this.getValidAccessToken();
        config.log(3,`✓ Access token obtained for key ending in ...${this.api_key.slice(-4)}`);
        const ai = axios.default.create({
            baseURL: config.base_url,
            headers: { accept: 'application/json' }
        });
        ai.interceptors.request.use(async( config_ ) => {
            // @ts-expect-error
            config_.headers = config.headers || {};
            config_.headers.Authorization = `Bearer ${accessToken}`;
            if (config.log_level>2 ) {
                config.log(2, `→ ${config_.method?.toUpperCase()} ${config_.url}`);
                if (config_.data)
                    config.log(2, '  Data:', JSON.stringify(config_.data, null, 2));
                if (config_.params)
                    config.log(1, '  Params:', config_.params);
            }
            return config_;
        });
        let retried = false;
        ai.interceptors.response.use(
            ( r ) => {
                if( config.log_level>2 ) {
                    config.log(1, `← ${r.status} ${r.config.method?.toUpperCase()} ${r.config.url}`);
                    if (r.data && Object.keys(r.data).length < 20) {
                        config.log(3, '  Response:', JSON.stringify(r.data, null, 2));
                    } else if (r.data) {
                        config.log(3, `  Response: [${typeof r.data}] ${Array.isArray(r.data) ? r.data.length + ' items' : 'large object'}`);
                    }
                }
                return r;
            },
            async (error) => {
                const status = error?.response?.status;
                if( config.log_level>2 ) {
                    config.log(1, `← ${status} ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
                    if (error.response?.data)
                        config.log(1, '  Error data:', error.response.data);
                }
                if( status === 401 && !retried ) {
                    retried = true;
                    config.log(2, '🔄 Retrying with fresh token...');
                    accessToken = await this.forceReauth();
                    error.config.headers.Authorization = `Bearer ${accessToken}`;
                    return ai.request(error.config);
                }
                throw error;
            }
        );
        return (this.client=new Client(ai));
    }
    // These 2 provide cached versions of projects and profile
    async listProjectBases() : Promise<ProjectBase[]> {
        if( this.projectBaseById )
            return Object.values(this.projectBaseById);
        if( !this.client )
            throw new Error('Client not initialized. Call getClient() first.');
        return this.client.listProjectBases().then( projectBases => {
            this.projectBaseById = projectBases.reduce( (acc,pb) => {
                acc[pb.id] = pb;
                return acc;
            },{} as Record<string,ProjectBase>);
            return projectBases;
        });
    }
    async getProjects() : Promise<Project[]> {
        if( this.projectById )
            return Object.values(this.projectById);
        await this.listProjectBases();
        if( !this.projectBaseById )
            throw new Error('Projects not loaded. Call listProjectBases() first.');
        return Promise.all(Object.values(this.projectBaseById).map(pb=>this.client.getProject(pb.id))).then( projects => {
            this.projectById = projects.reduce( (acc,p) => {
                acc[p.id] = p;
                return acc;
            },{} as Record<string,Project>);
            return projects;
        });
    }
    pullProjects() : Promise<Project[]> {
        return this.getProjects().then( projects => {
            return Promise.all(projects.map(p=>this.pullProject(p)));
        });
    }
    getCustomerProfile() {
        if( this.profile )
            return this.profile;
        if( !this.client )
            throw new Error('Client not initialized. Call getClient() first.');
        return this.client.getCustomerProfile().then( profile => {
            this.profile = profile;
            return profile;
        });
    }
}
