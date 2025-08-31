import * as axios   from 'axios';
import {
    Skill,
    Flow,
    Agent,
    Project,
    ProjectBase
}                   from './Types';

export default class Client {
    // private
    private async listProjectAgents( project_id:string ) {
        const r = await this.axios.get(`/api/v1/bff/agents/list`, { params: { project_id } });
        return r.data as Agent[];
    }
    private async getProjectBase( project_id:string ) {
        const r = await this.axios.get(`/api/v1/designer/projects/by-id/${project_id}`);
        return r.data as ProjectBase;
    }
    private async listFlowSkills( flowId:string ) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/skills`);
        return r.data as Skill[];
    }
    private async getSkill(skillId) {
        const r = await this.axios.get(`/api/v1/designer/skills/${skillId}`);
        return r.data as Skill;
    }
    private async updateSkill(skillObject) {
        await this.axios.put(`/api/v1/designer/flows/skills/${skillObject.id}`, skillObject);
    }
    private async listFlowEvents(flowId) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/events`);
        return r.data;
    }
    private async listFlowStates(flowId) {
        const r = await this.axios.get(`/api/v1/designer/flows/${flowId}/states`);
        return r.data;
    }
    private async importAkbArticle(articleData) {
        const r = await this.axios.post('/api/v1/akb/append-manual', articleData);
        return r.data;
    }
    // public
    constructor( private axios:axios.AxiosInstance ) {
    }
    async listProjects() {
        const r = await this.axios.get(`/api/v1/designer/projects`);
        return r.data as Project[];
    }
    async getProject( project_id:string ) {
        const [project,agents] = await Promise.all([
            this.getProjectBase(project_id) as Promise<Project>,
            this.listProjectAgents(project_id)
        ]);
        project.agents = await Promise.all(agents.map( async (a) => {
            a.flows = await Promise.all((a.flows as any[]).map( async (f) => {
                f.skills = await this.listFlowSkills(f.id) as any;
                return f;
            }));
            return a;
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
