export interface Skill {
    id              : string;
    title           : string; 
    idn             : string;
    runner_type     : string;
    model           : any; 
    parameters      : any[];
    path            : string;
    prompt_script?  : string;
}
export interface Flow {
    id              : string; 
    skills          : Record<string,Skill>;
}
export interface Agent {
    id              : string;
    flows           : Record<string,Flow>; 
}
export interface Project {
    projectId       : string;
    projectIdn      : string;
    agents          : Record<string,Agent>;
}
