import * as axios       from 'axios';
import * as jwtDecode   from 'jwt-decode';
import {
    FlowSkill,
    Flow,
    FlowEvent,
    Agent,
    Project,
    ProjectMeta
}                   from './Types';
import config       from './Config';

export default class Client {
    private anotherToken? : string;

    // private
    private async listProjectAgents( project_id:string ) {
        const r = await this.axios.get(`/api/v1/bff/agents/list`, { params: { project_id } });
        return r.data as Agent[];
    }
    private async getProjectMeta( project_id:string ) {
        const r = await this.axios.get(`/api/v1/designer/projects/by-id/${project_id}`);
        return r.data as ProjectMeta;
    }
    private async listFlowSkills( flowId:string ) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/skills`);
        return r.data as FlowSkill[];
    }
    private async listFlowEvents(flowId) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/events`);
        return r.data as FlowEvent[];
    }
    private async listFlowStates(flowId) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/states`);
        return r.data;
    }
    private async getSkill(skillId) {
        const r = await this.axios.get(`/api/v1/designer/skills/${skillId}`);
        return r.data as FlowSkill;
    }
    private async updateSkill(skillObject) {
        await this.axios.put(`/api/v1/designer/flows/skills/${skillObject.id}`, skillObject);
    }
    private async importAkbArticle(articleData) {
        const r = await this.axios.post('/api/v1/akb/append-manual', articleData);
        return r.data;
    }
    // public
    constructor(
        private         axios       : axios.AxiosInstance,
        public readonly accessToken : string,
        private         forceReauth : (()=>Promise<string>)
    ) {
        axios.interceptors.request.use(async( config_ ) => {
            // @ts-expect-error
            config_.headers = config.headers || {};
            config_.headers.Authorization = `Bearer ${accessToken}`;
            //console.log({accessToken,url:config_.url});
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
        axios.interceptors.response.use(
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
                    accessToken = await forceReauth();
                    error.config.headers.Authorization = `Bearer ${accessToken}`;
                    return axios.request(error.config);
                }
                throw error;
            }
        );
    }
    async listProjectMetas() : Promise<ProjectMeta[]> {
        const r = await this.axios.get(`/api/v1/designer/projects`);
        return r.data as ProjectMeta[];
    }
    async getProject( project_id:string )  : Promise<Project> {
        const [project,agents] = await Promise.all([
            this.getProjectMeta(project_id) as Promise<Project>,
            this.listProjectAgents(project_id)
        ]);
        project.agents = await Promise.all(agents.map((a) => {
            return Promise.all(a.flows.map( f => {
                return Promise.all([
                    this.listFlowSkills(f.id).then( skills => {
                        f.skills = skills;
                    }),
                    this.listFlowEvents(f.id).then( events => {
                        f.events = events;
                    }),
                    this.listFlowStates(f.id).then( states => {
                        f.states = states;
                    })
                ]).then( () => {
                    return f;
                });
            })).then( flows => {
                a.flows = flows;
                return a;
            });
        }));
        return project;
    }
    async getCustomerProfile() {
        const r = await this.axios.get(`/api/v1/customer/profile`);
        delete r.data.password;
        delete r.data.logo;
        return r.data;
    }
    async getCustomerAttrs( include_hidden=false ) {
        const r = await this.axios.get(`/api/v1/bff/customer/attributes`, { params: { include_hidden } });
        return r.data;
    }
    async getCustomerAcctLinks() {
        if( !this.anotherToken ) {
            // Trying to get token from generate-customer-token using the token we already have.
            // Apparently this does not work :(
            const decodedToken = jwtDecode.jwtDecode(this.accessToken) as jwtDecode.JwtPayload & { customer_id:string };
            const foo = await this.axios.post("/api/v1/auth/generate-customer-token",{
                to_customer_id : decodedToken.customer_id
            }).catch( err => {
                return err;
            });
            //console.log({decodedToken,foo});
        }
        const r = await this.axios.get(`/api/v1/account`,{}).catch( err => {
            return {
                data : {
                    message : err.message,
                    status  : err.status,
                    code    : err.code,
                    data    : err.response?.data
                }
            };
            //console.log({err);
            //return err;
        });
        return r.data;
    }
    async getSessions( argv:Record<string,any> ) {
        const params = ['page','fromDate','toDate','isLead','isTest','connectorId','per'].reduce( (acc, p) => {
            if( argv[p] )
                acc[p] = argv[p];
            return acc;
        },{} as Record<string,string|boolean>);
        const r = await this.axios.get(`/api/v1/bff/sessions`, { params });
        return r.data;
    }
}
