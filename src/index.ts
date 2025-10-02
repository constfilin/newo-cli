#!/usr/bin/env npx tsx

import util             from 'node:util';
import dayjs            from 'dayjs';

import consoleTable     from 'console.table';
import commandLineArgs  from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import objToCsv         from 'objects-to-csv';
import OpenAI           from 'openai';

import config           from './Config';

const cmdSections = [
    {
        header : 'NEWO CLI',
        content: [
            'Command line interface to NEWO. Configuration is read from environment variables or .env file.',
        ]
    },
    {
        header : 'Commands',
        content: [
            "help                   Show this help message",
            "pullProjects           Pull projects for all customers",
            "listProjectMetas       List metadata of all projects for all customers",
            "getProject             Get details of a specific project",
            "getCustomerProfile     Get profile information for all customers",
            "getCustomerAttrs       Get customer attributes for all customers",
            "getCustomerAcctLinks   Get customer account links for all customers",
            "getSessions            Get sessions for all customers",
        ]
    },
    {
        header : 'General options',
        optionList: [
            { name: 'command'       ,alias: 'c', type: String    , defaultValue:'help'  ,defaultOption:true, description: "The command to execute" },
            { name: 'stringify'     ,alias: 's', type: Boolean   , defaultValue: false  ,description: "Format output as a JSON string" },
            { name: 'csv'           ,alias: 'v', type: Boolean   , defaultValue: false  ,description: "Format output as a CSV" },
            { name: 'tableColLength',alias: 't', type: Number    , defaultValue: 0      ,description: "Format output as a table, truncating column names to this length (0=off)" },
            { name: 'keeparray'     ,alias: 'k', type: Boolean   , defaultValue: false  ,description: "If not set and the output is an array with a single element, then outputs only this element" },
            { name: 'sortColumn'    ,alias: 'o', type: String    , defaultValue: ''     ,description: "Column name to sort by if output is an array" },
            { name: 'sortDirection', alias: 'd', type: Number    , defaultValue: 1      ,description: "Directon to sort by if output is an array (1 or -1)" },
            { name: 'abreviate'     ,alias: 'b', type: Boolean   , defaultValue: false  ,description: "Abbreviate output (means different things for different commands)" },
        ]
    },
    {
        header : 'getProject command options',
        optionList: [
            { name: 'projectId'     ,alias: 'p', type: String    , defaultValue: ''     , description: 'Required. A customer can have many projects' },
        ]
    },
    {
        header : 'getCustomerAttrs command options',
        optionList: [
            { name: 'includeHidden' ,alias: 'i', type: Boolean   , defaultValue: false , description: 'Include hidden attributes, optional' },
            { name: 'attributeIdns' ,alias: 'a', type: String    , defaultValue: '' , description: 'Comma-separated list of attribute IDNs to retrieve, optional'    },
        ]
    },
    {
        header : 'getSessions command options',
        optionList: [
            { name: 'fromDate'      ,alias: 'f', type: String    , defaultValue: '' , description: 'optional' },
            { name: 'toDate'        ,alias: 'u', type: String    , defaultValue: '' , description: 'optional' },
            { name: 'isLead'        ,alias: 'l', type: String    , defaultValue: '' , description: 'optional' },
            { name: 'isTest'        ,alias: 'e', type: String    , defaultValue: '' , description: 'optional' },
            { name: 'connectorId'   ,alias: 'n', type: String    , defaultValue: '' , description: 'optional' },
            { name: 'page'          ,alias: 'g', type: Number    , defaultValue: 1  , description: 'optional' },
            { name: 'per'           ,alias: 'r', type: Number    , defaultValue: 50 , description: 'optional' },
            { name: 'openAI'        ,alias: 'z', type: Boolean   , defaultValue: false, description: 'If set, and if the OPENAI_API_KEY environment variable is set, then uses OpenAI to summarize the session transcript' },
        ]
    }
];


const argv = commandLineArgs(
    cmdSections.map(s=>s.optionList).filter(ol=>!!ol).flat());

const getCmdPromise = async ( argv:Record<string,any> ) : Promise<() => any> => {
    if( argv.command==='help' )
        return (()=>commandLineUsage(cmdSections));
    // No need to remember clients here - they are cached in Customer class
    await Promise.all(config.customers.map( c => {
        return c.getClient()
            .then( client => {
                config.log(2, `✓ Client initialized for customer with API key ending in ...${c.apiKey.slice(-4)}`);
                return client;
            })
            .catch( e => {
                throw Error(`❌ Error initializing client for customer with API key ending in ...${c.apiKey.slice(-4)}: ${e.message}`);
            });
    }));
    config.log(1, `✓ Clients initialized for ${config.customers.length} customer(s)`);
    switch( argv.command ) {
        case 'pullProjects':
            return (() => Promise.all(config.customers.map(c=>c.pullProjects())));
        case 'projectStatus':
            return (() => Promise.all(config.customers.map(c=>c.projectStatus())));
        case 'listProjectMetas':
            return (() => Promise.all(config.customers.map(c=>c.listProjectMetas())))
        case 'getProject':
            return (() => Promise.all(config.customers.map(c=>c.client.getProject(argv.projectId))));
        case 'getCustomerProfile':
            return (() => Promise.all(config.customers.map(c=>c.getCustomerProfile())));
        case 'getSessions':
            return (() => Promise.all(config.customers.map(c=>c.getSessions(argv).then( r => {
                if( !argv.csv && (argv.tableColLength<=0) )
                    return r;
                return r.items.map( i => {
                    i.contact = (typeof i.persona === 'object') ? (i.persona.name??i.persona.id) : '???';
                    delete i.persona;
                    return i;
                });
            }))));
        case 'getCustomerAttrs': {
            const attributeIdns = argv.attributeIdns ? argv.attributeIdns.split(',').map(s=>s.trim()).filter(s=>s.length>0) : [];
            const attributeNdxs = attributeIdns.reduce( (acc,idn,ndx) => {
                acc[idn] = ndx;
                return acc;
            },{} as Record<string,number>);
            return (() => Promise.all(config.customers.map( async ( c ) => {
                const [profile,attrs] = await Promise.all([
                    c.getCustomerProfile(),
                    c.client.getCustomerAttrs(argv.includeHidden).then( attrs => {
                        if( attributeIdns.length>0 ) {
                            const idns = argv.attributeIdns.split(',').map(s=>s.trim()).filter(s=>s.length>0);
                            return attrs.attributes.filter( a => attributeIdns.includes(a.idn) );
                        }
                        return attrs.attributes;
                    })
                ]);
                if( !attributeIdns.length )
                    return attrs;
                // Else do special filtering and formatting
                return {
                    profile : {
                        id      : profile.id,
                        idn     : profile.idn,
                        name    : profile.name,
                        email   : profile.email
                    },
                    attrs : attrs
                        .filter( a => {
                            return attributeIdns.includes(a.idn);
                        })
                        .sort( (a,b) => {
                            // Sort the attributes in the order they were requested
                            return (attributeNdxs[a.idn]||0) - (attributeNdxs[b.idn]||0);
                        })
                        .map( a => {
                            return {
                                idn     : a.idn,
                                value   : a.value,
                            };
                        })
                }
            })).then( (results:({profile:Record<string,any>,attrs:Record<string,any>[]})[]) => {
                if( !attributeIdns.length ) {
                    if( argv.abreviate )
                        return results.map(r=>(r as unknown as Array<Record<string,any>>).map(a => {
                            return {
                                idn   : a.idn,
                                value : argv.tableColLength ? String(a.value).substring(0,argv.tableColLength) : a.value,
                            }
                        }));
                    return results;
                }
                const getObjArray = ( colNameGetter:((s:string,colNames:Record<string,any>)=>string) ) => {
                    return results.reduce( (acc,res,ndx) => {
                        const line = res.attrs.reduce( (acc2,attr) => {
                            acc2[colNameGetter(attr.idn,acc2)] = attr.value;
                            return acc2;
                        },{
                            IDN : res.profile.idn,
                        } as Record<string,any>);
                        acc.push(line);
                        return acc;
                    },[] as Record<string,any>[]);
                }
                if( argv.tableColLength>0 )
                    return getObjArray( (s,colNames)=> {
                        // Truncation of attributes IDNs can create colliding column names
                        s = s.replace(/^project_/,'').replace(/^attributes_/,'').replace(/^setting_/,'').substring(0,argv.tableColLength)
                        while( (s.length>4) && (s in colNames) )
                            s = s.substring(0,s.length-1);
                        return s;
                    });
                if( argv.csv )
                    return getObjArray(s=>s);
                return results;
            }));
        }
        case 'getCustomerAcctLinks': {
            return (() => Promise.all(config.customers.map(c=>c.getCustomerAccountLinks())));
        }
    }
    return (() => {
        throw Error(`Unknown command: '${argv.command}'. Use '${process.argv[1]} -c help' for usage.`);
    });
}

const log = ( ...args:any ) => {
    process.stderr.write(`${dayjs().format("YYYY-MM-DD HH:mm:ss")}: `+util.format(...args)+'\n');
}

const main = async () => {
    return getCmdPromise(argv).then(proc=>proc());
}
const sortIfArray = ( r:any ) => {
    if( !Array.isArray(r) )
        return r;
    if( !argv.sortColumn )
        return r;
    return r.sort( (a,b) => {
        const left = a[argv.sortColumn];
        const right = b[argv.sortColumn];
        if( typeof left === 'number' && typeof right === 'number' )
            return (left-right)*argv.sortDirection;
        return String(left).localeCompare(String(right))*argv.sortDirection;
    });
}
main().then( r => {
    if( Array.isArray(r) && r.length===1 && !argv.keeparray )
        r = r[0];
    if( !argv.openAI || !process.env.OPENAI_API_KEY ) {
        if( argv.stringify )
            return JSON.stringify(sortIfArray(r),null,4);
        else if( argv.csv )
            return (new objToCsv(Array.isArray(r)?sortIfArray(r):[r])).toString();
        else if( argv.tableColLength>0 )
            return consoleTable.getTable(sortIfArray(r));
        else
            return r;
    }
    else {
        const items = sortIfArray(r.items.filter(i=>i.arguments?.transcript).map(i=>{
            return {
                session_id : i.id,
                created_at : i.created_at,
                persona_id : i.persona?.id,
                transcript : i.arguments?.transcript,
            };
        }));
        // We are going to analyze the sessions using OpenAI
        // TODO: bundle the API calls in groups of 5 or 10 to speed things up
        const openAI    = new OpenAI({apiKey:process.env.OPENAI_API_KEY});
        const chunkSize = 20;
        const getOpenAIPromise = ( ndx:number ) => {
            if( ndx>=items.length )
                return;
            const chunk = items.slice(ndx,ndx+chunkSize);
            log(`⏳ Calling OpenAI for ${chunkSize} starting from #${ndx} '${chunk.at(0).created_at}' to '${chunk.at(-1).created_at}' out of ${items.length}`);
            return Promise.all(chunk.map( (item) => {
                return openAI.chat.completions.create({
                    model : 'gpt-5',
                    messages : [{ role: "user", content: `
    You are a professional analyzer of conversations happening when a person calls a restaurant and books a table.
    Your job is to analyze conversation provided in <Conversation> section below and extract from it the date the
    caller wants a table for. All messages starting from "ConvoAgent:" come from the restaurant itself.
    <Conversation>
    ${item.transcript}
    </Conversation>
    Provide your answer in JSON format as { "date":string, "time":string }.
    ` }],
                }).then( resp => {
                    let result = { date: null, time: null };
                    try {
                        result = JSON.parse(resp.choices?.[0]?.message?.content);
                    }
                    catch(e) {
                        log(`❌ OpenAI response for #${ndx} is not valid JSON: ${resp.choices?.[0]?.message?.content}`);
                    }
                    return result;
                });
            })).then( results => {
                log(`✓ OpenAI responded for ${chunkSize} starting from #${ndx} out of ${items.length}`,results);
                if( results.length!==chunk.length )
                    log(`⚠️ Warning: only ${results.length} results returned from OpenAI out of ${chunk.length} requests`);
                for( let i=0; i<results.length; i++ ) {
                    chunk[i].date = results[i].date;
                    chunk[i].time = results[i].time;
                }
                return getOpenAIPromise(ndx+chunkSize);
            });
        }
        return getOpenAIPromise(0)
            .then( () => {
                return (new objToCsv(items)).toString();
            }).catch( e => {
                throw Error(`❌ Error calling OpenAI: ${e.message}`);
            });
    }
}).then(console.log).catch(console.error);
