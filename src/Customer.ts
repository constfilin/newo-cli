import path         from 'node:path';
import fs           from 'node:fs';
import crypto       from 'node:crypto';

import fsExtra      from 'fs-extra';
import jsYaml       from 'js-yaml';
import * as axios   from 'axios';

import config       from './Config';
import Client       from './Client';
import * as utils   from './utils';
import {
    Flow,
    FlowSkill,
    Project,
    ProjectMeta,
    Agent
}               from './Types';

export default class Customer {

    private projectPath     : string;
    private statePath       : string;
    private access_token?   : string;
    private refresh_token?  : string;
    private refresh_url?    : string;

    public  apiKey         : string;
    public  client?         : Client;
    public  projectMetasById?: Record<string,ProjectMeta>;
    public  projectsById?   : Record<string,Project>;
    public  profile?        : Record<string,any>;

    // private
    private async loadTokens() {
        const tokensPath = path.join(this.statePath,"tokens.json");
        if( await fsExtra.pathExists(tokensPath) )
            return fsExtra.readJson(tokensPath);
        if( this.access_token || this.refresh_token ) {
            const tokens = {
                access_token    : this.access_token || '',
                refresh_token   : this.refresh_token || '',
                expires_at      : Date.now() + 10 * 60 * 1000
            };
            await fsExtra.writeJson(tokensPath,tokens,{ spaces:2 });
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
        const url       = `${config.baseUrl}/api/v1/auth/api-key/token`;
        const res       = await axios.default.post(url, {}, { headers: { 'x-api-key': this.apiKey, 'accept': 'application/json' } });
        const data      = res.data || {};
        const access    = data.access_token || data.token || data.accessToken;
        const refresh   = data.refresh_token || data.refreshToken || '';
        const expiresInSec = data.expires_in || data.expiresIn || 3600;
        const tokens    = {
            access_token    : access,
            refresh_token   : refresh,
            expires_at      : Date.now() + expiresInSec * 1000
        };
        await fsExtra.writeJSON(path.join(this.statePath,"tokens.json"),tokens,{ spaces:2} );
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
        const access_token  = data.access_token || data.token || data.accessToken;
        const refresh_token = data.refresh_token ?? refreshToken;
        const expiresInSec  = data.expires_in || 3600;
        const tokens = { 
            access_token: access_token, 
            refresh_token: refresh_token, 
            expires_at: Date.now() + expiresInSec * 1000 
        };
        await fsExtra.writeJSON(path.join(this.statePath,"tokens.json"),tokens,{ spaces:2} );
        return tokens;
    }
    private async forceReauth() {
        const tokens = await this.exchangeApiKeyForToken();
        return tokens.access_token;
    }
    private async pullProject( project:Project ) {
        config.log(1,`Pulling project ${project.title} (${project.idn})`);
        const projectPath = utils.enforceDirectory(path.join(this.projectPath,project.idn));
        const getSkillPath = ( a:Agent, f:Flow, s:FlowSkill ) => {
            const extension = s.runner_type === 'nsl' ? '.jinja' : '.guidance';
            const skillPath = path.join(projectPath,a.idn,f.idn);
            utils.enforceDirectory(skillPath);
            return path.join(skillPath,`${s.idn}${extension}`);
        }
        const writeMetadata = () => {
            const base = this.projectMetasById?.[project.id];
            if( !base )
               throw new Error(`Project base not found for project ID ${project.id}`);
            return fsExtra.writeJson(path.join(projectPath,'metadata.json'),base,{ spaces: 2 });
        }
        const writeSkills = () => {
            return Promise.all(project.agents.flatMap( a => {
                //console.log(2,`Processing agent`,a);
                a.flows.flatMap( f =>
                    f.skills.map( s => {
                        return fs.writeFileSync(getSkillPath(a,f,s),s.prompt_script||'');
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
            const yamlContent = jsYaml.dump(flowsData,{
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
            // Now that all the files are saved, let's count their hashes
            const hashes = project.agents.reduce( (acc,a) => {
                return a.flows.reduce( (acc,f) => {
                    return f.skills.reduce( (acc,s) => {
                        const skillPath = getSkillPath(a,f,s);
                        acc[skillPath] = crypto.createHash('sha256').update(fs.readFileSync(skillPath,'utf8'),'utf8').digest('hex');
                        return acc;
                    },acc);
                },acc);
            },{} as Record<string,string>);
            return fsExtra.writeJSON(path.join(this.statePath,"hashes.json"),hashes,{ spaces : 2} );
        }).then( () => {
            return project;
        });
    }
    // public
    constructor( apiKey:string, projectPath:string, statePath:string ) {
        if( !apiKey )
            throw new Error('NEWO_API_KEY not set. Provide an API key in .env');
        this.apiKey        = apiKey;
        this.projectPath   = utils.enforceDirectory(projectPath);
        this.statePath     = utils.enforceDirectory(statePath);
    }
    async getClient() : Promise<Client> {
        if( this.client )
            return this.client;
        let accessToken = await this.getValidAccessToken();
        config.log(3,`✓ Access token obtained for key ending in ...${this.apiKey.slice(-4)}`);
        const ai = axios.default.create({
            baseURL: config.baseUrl,
            headers: { accept: 'application/json' }
        });
        ai.interceptors.request.use(async( config_ ) => {
            // @ts-expect-error
            config_.headers = config.headers || {};
            config_.headers.Authorization = `Bearer ${accessToken}`;
            if (config.logLevel>2 ) {
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
                if( config.logLevel>2 ) {
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
                if( config.logLevel>2 ) {
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
    async listProjectMetas() : Promise<ProjectMeta[]> {
        if( this.projectMetasById )
            return Object.values(this.projectMetasById);
        if( !this.client )
            throw new Error('Client not initialized. Call getClient() first.');
        return this.client.listProjectMetas().then( projectMetas => {
            this.projectMetasById = projectMetas.reduce( (acc,pb) => {
                acc[pb.id] = pb;
                return acc;
            },{} as Record<string,ProjectMeta>);
            return projectMetas;
        });
    }
    async getProjects() : Promise<Project[]> {
        if( this.projectsById )
            return Object.values(this.projectsById);
        await this.listProjectMetas();
        if( !this.projectMetasById )
            throw new Error('Projects not loaded. Call listProjectMetas() first.');
        return Promise.all(Object.values(this.projectMetasById).map(pb=>this.client.getProject(pb.id))).then( projects => {
            this.projectsById = projects.reduce( (acc,p) => {
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
