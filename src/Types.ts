export interface Skill {
    id                      : string;
    title                   : string;
    idn                     : string;
    runner_type             : string;
    model                   : any;
    parameters              : any[];
    path                    : string;
    prompt_script?          : string;
}
export interface FlowBase {
    id                      : string;
    title                   : string;
    description             : string|null;
    idn                     : string;
    publication_datetime    : string;
    last_change_datetime    : string;
    creation_datetime       : string;
    default_runner_type     : string;
    default_model           : {
        provider_idn        : string;
        model_idn           : string;
    }
}
export interface Flow extends FlowBase {
    skills                  : Skill[];
}
export interface Agent {
    id                      : string;
    flows                   : Flow[];
}
export interface ProjectBase {
    id                      : string;
    idn                     : string;
    title                   : string;
    version                 : string;
    description             : string|null;
    is_synchronized         : boolean,
    preferred_update_time   : string|null;
    is_auto_update_enabled  : boolean;
    registry_idn            : string;
    registry_item_idn       : string;
    registry_item_version   : string|null;
    created_at              : string;
    updated_at              : string;
}
export interface Project extends ProjectBase {
    agents                  : Agent[];
}
