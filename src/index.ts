#!/usr/bin/env npx tsx

import commandLineArgs  from 'command-line-args'; 

import * as Client      from './Client'; 
import Cli              from './Cli';

const argv = commandLineArgs([
    { name: 'command',      alias: 'c', type: String, defaultValue: 'help', defaultOption: true },
    { name: 'logLevel',     alias: 'l', type: Number, defaultValue: 2 },
    { name: 'projectId',    alias: 'p', type: String, defaultValue: '' },
]);

const getCmdPromise = async ( argv:Record<string,any> ) : Promise<() => any> => {

    const cli = new Cli();

    if( argv.command==='help' )
        return () => {
            cli.log(1,`NEWO CLI
Usage:
newo pull                    # download all projects -> ./projects/ OR specific project if NEWO_PROJECT_ID set
newo push                    # upload modified *.guidance/*.jinja back to NEWO
newo status                  # show modified files
newo meta                    # get project metadata (debug, requires NEWO_PROJECT_ID)
newo import-akb <file> <persona_id>  # import AKB articles from file

Flags:
--verbose, -v                # enable detailed logging

Env:
NEWO_BASE_URL, NEWO_PROJECT_ID (optional), NEWO_API_KEY, NEWO_REFRESH_URL (optional)

Notes:
- multi-project support: pull downloads all accessible projects or single project based on NEWO_PROJECT_ID
- If NEWO_PROJECT_ID is set, pull downloads only that project
- If NEWO_PROJECT_ID is not set, pull downloads all projects accessible with your API key
- Projects are stored in ./projects/{project-idn}/ folders
- Each project folder contains metadata.json and flows.yaml
`);
    };

    const client = await Client.get(cli);

    switch( argv.command ) {
    //case 'getAttrs':
    //    return Promise.resolve(() => Sync.pullAll(cli,client));
    case 'listProjects':
        return (() => client.listProjects());
    case 'listAgents':
        return (() => client.listAgents(cli.project_id));
    case 'getProject':
        return (() => client.getProject(cli.project_id));
    }

    return (() => {
        throw Error(`Unknown command: ${argv.command}. Use "newo help" for usage.`);
    });
}
const main = async () => {
    return getCmdPromise(argv).then(proc=>proc());
}

main().then(console.log).catch(console.error);
