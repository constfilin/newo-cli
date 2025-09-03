import * as axios   from 'axios';
import {
    FlowSkill,
    Flow,
    FlowEvent,
    Agent,
    Project,
    ProjectMeta
}                   from './Types';

export default class Client {
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
    constructor( private axios:axios.AxiosInstance ) {
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
}
