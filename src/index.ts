#!/usr/bin/env npx tsx

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
            "getAttributes          Get customer attributes for all customers",
            "getCustomerAcctLinks   Get customer account links for all customers",
            "getSessions            Get sessions for all customers",
        ]
    },
    {
        header : 'General options',
        optionList: [
            { name: 'command'       ,            type: String    , defaultValue:'help'  ,defaultOption:true, description: "The command to execute" },
            { name: 'stringify'     ,alias: 's', type: Boolean   , defaultValue: false  ,description: "Format output as a JSON string" },
            { name: 'csv'           ,alias: 'v', type: Boolean   , defaultValue: false  ,description: "Format output as a CSV" },
            { name: 'tableColLength',alias: 't', type: Number    , defaultValue: 0      ,description: "Format output as a table, truncating column names to this length (0=off)" },
            { name: 'keepArray'     ,alias: 'k', type: Boolean   , defaultValue: false  ,description: "If not set and the output is an array with a single element, then outputs only this element" },
            { name: 'sortColumn'    ,alias: 'o', type: String    , defaultValue: ''     ,description: "Column name to sort by if output is an array" },
            { name: 'sortDirection' ,alias: 'd', type: Number    , defaultValue: 1      ,description: "Directon to sort by if output is an array (1 or -1)" },
            { name: 'abbreviate'    ,alias: 'b', type: Boolean   , defaultValue: false  ,description: "Abbreviate output (means different things for different commands)" },
            { name: 'columnNames'   ,alias: 'c', type: String    , defaultValue: undefined , description: "Comma-separated list of columns to output, columns will be output in this order" },
        ]
    },
    {
        header : 'getProject command options',
        optionList: [
            { name: 'projectId'     ,alias: 'p', type: String    , defaultValue: ''     , description: 'Required. A customer can have many projects' },
        ]
    },
    {
        header : 'getAttributes command options',
        optionList: [
            { name: 'includeHidden' ,alias: 'i', type: Boolean   , defaultValue: false , description: 'Include hidden attributes, optional' },
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
    },
    {
        header  : 'Environment variables',
        content : [
            { var: "NEWO_BASE_URL"      , desription: "defaults to 'https://app.newo.ai'" },
            { var: "NEWO_PROJECTS_DIR"  , desription: "folder where to put projects to, defaults to ./projects" },
            { var: "NEWO_STATE_DIR"     , desription: "where to keep the temp auth tokens, defaults to './.newo" },
            { var: "NEWO_API_KEYS"      , desription: "comma separately list of secret keys identifying agents to talk to" },
            { var: "LOG_LEVEL"          , desription: "numerical verbosity level, the higher, the chattier" },
            { var: "OPENAI_API_KEY"     , desription: "used with -z option to send each extracted sesson to OpenAI for analysis, see code" }
        ]
    }
];

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
            return (
                () => Promise.all(config.customers.map(c=>c.getSessions(argv)))
                    .then( results => {
                        if( !argv.csv && (argv.tableColLength<=0) ) {
                            // Return raw results because the output is not csv, nor a table
                            return results;
                        }
                        // Otherwise massage the results a bit to make them flat
                        return results.map( r => {
                            r.items = r.items.map( i => {
                                Object.assign(i,i.arguments||{});
                                delete i.arguments;
                                i.contact = (typeof i.persona === 'object') ? (i.persona.name??i.persona.id) : '???';
                                delete i.persona;
                                return i;
                            });
                            return r;
                        });
                    })
                    .then( results => {
                        if( !argv.csv && (argv.tableColLength<=0) ) {
                            // Return raw results because the output is not csv, nor a table
                            return results;
                        }
                        if( !argv.openAI || !process.env.OPENAI_API_KEY ) {
                            // No further processing needed
                            return results;
                        }
                        // We are going to analyze the sessions using OpenAI
                        // The job of this code is to add `date` and `time` to each returned item
                        // Also we do this only for lead and not test session items
                        const openAI    = new OpenAI({apiKey:process.env.OPENAI_API_KEY});
                        const chunkSize = 20;
                        return Promise.all(results.map( r => {
                            r.items = r.items.filter(i=>(i.is_lead && !i.is_test && i.transcript));
                            // We are going to analyze the sessions in chunks
                            const getOpenAIPromise = ( ndx:number ) => {
                                if( ndx>=r.items.length )
                                    return Promise.resolve();
                                const chunk_items = r.items.slice(ndx,ndx+chunkSize);
                                config.log(2,`⏳ Calling OpenAI for ${chunkSize} starting from #${ndx} '${chunk_items.at(0).created_at}' to '${chunk_items.at(-1).created_at}' out of ${r.items.length}`);
                                return Promise.all(
                                    chunk_items.map( (item) => {
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
                        `                   }],
                                        }).then( resp => {
                                            let result = { date: null, time: null };
                                            try {
                                                result = JSON.parse(resp.choices?.[0]?.message?.content);
                                            }
                                            catch(e) {
                                                config.log(1,`❌ OpenAI response for #${ndx} is not valid JSON: ${resp.choices?.[0]?.message?.content}`);
                                            }
                                            item.date = result.date;
                                            item.time = result.time;
                                            return result;
                                        })
                                    })
                                );
                            };
                            return getOpenAIPromise(0)
                                .then( () => {
                                    return r;
                                })
                                .catch( e => {
                                    throw Error(`❌ Error calling OpenAI: ${e.message}`);
                                });
                        }));
                    })
                    .then( results => {
                        if( !argv.csv && (argv.tableColLength<=0) ) {
                            // Return raw results because the output is not csv, nor a table
                            return results;
                        }
                        return results.map(r=>r.items);
                    })
            );
        case 'getAttributes': {
            return (
                () => Promise.all(config.customers.map(c=>c.getAttributes(argv)))
                    .then( results => {
                        if( !argv.columnNames ) {
                            // Return raw results because the output is not csv, nor a table
                            return !argv.abreviate ? results : results.map(r=>r.attributes.map(a => {
                                return {
                                    idn   : a.idn,
                                    value : a.value,
                                };
                            }));
                        }
                        return results.reduce( (acc,res) => {
                            acc.push(Object.fromEntries([
                                ['IDN',res.profile.idn],
                                ...res.attributes.map(attr=>([attr.idn,attr.value]))
                            ]));
                            return acc;
                        },[] as Record<string,any>[]);
                    })
            );
        }
        case 'getCustomerAcctLinks': {
            return (() => Promise.all(config.customers.map(c=>c.getCustomerAccountLinks())));
        }
    }
    return (() => {
        throw Error(`Unknown command: '${argv.command}'. Use '${process.argv[1]} -c help' for usage.`);
    });
}

export const sortIfArray = ( records:Record<string,any>[], sortColumn:string, sortDirection:number, columnNames?:string ) : Record<string,any>[] => {
    if( !Array.isArray(records) )
        return records;
    if( sortColumn ) {
        if( Array.isArray(records[0]) ) {
            // Flatten the records and add `rndx` column
            // @ts-expect-error
            records = records.reduce( (acc:Record<string,any>[],record,rndx) => {
                acc.push(...record.map( r => {
                    return {
                        rndx,
                        ...r
                    };
                }));
                return acc;
            },[] as Record<string,any>[]);
        }
        records = records.sort( (a,b) => {
            //console.log({a,b});
            const left = a[sortColumn];
            const right = b[sortColumn];
            if( typeof left === 'number' && typeof right === 'number' )
                return (left-right)*sortDirection;
            return String(left).localeCompare(String(right))*sortDirection;
        })
    }
    if( !argv.columnNames )
        return records;
    // Make sure that only given columns are in each row and they are in the specified order
    const columnNdxByName = (argv.columnNames as String).split(',').map(s=>s.trim()).filter(s=>s.length>0).reduce( (acc,idn,ndx) => {
        acc[idn] = ndx;
        return acc;
    },{} as Record<string,number>);
    return records.map( row => {
        return Object.fromEntries(
            Object.entries(row).filter( ([key,value]) => {
                return key in columnNdxByName;
            })
            .sort( ([key1,value1],[key2,value2]) => {
                return columnNdxByName[key1]-columnNdxByName[key2];
            })
        );
    });
}

const argv = commandLineArgs(cmdSections.map(s=>s.optionList).filter(ol=>!!ol).flat());
getCmdPromise(argv)
    .then(proc=>proc())
    .then( records => {
        // Final output formatting
        if( Array.isArray(records) && records.length===1 && !argv.keepArray ) {
            // So newo-cli can be used with many client keys at once and with one client key.
            // In either case we want to provide a table output. In newo-cli is used with just
            // one client key, then r is going to be an array of just one element with results
            // for this one client. Let's unpack it to help the code below visualize the results
            // better
            records = records[0];
        }
        if( argv.stringify )
            return JSON.stringify(sortIfArray(records,argv.sortColumn,argv.sortDirection,argv.columnNames),null,4);
        if( argv.csv )
            return (new objToCsv(Array.isArray(records)?sortIfArray(records,argv.sortColumn,argv.sortDirection,argv.columnNames):[records])).toString();
        if( argv.tableColLength>0 )
            return consoleTable.getTable(sortIfArray(records,argv.sortColumn,argv.sortDirection,argv.columnNames).map( o => {
                return Object.fromEntries(Object.entries(o).map( ([key,value]) => {
                    // Make sure that column widths do not exceed `tableColLength`
                    return [key.substring(0,argv.tableColLength),((typeof value==='string')?value:JSON.stringify(value)).substring(0,argv.tableColLength)];
                }));
            }));
        return records;
    })
    .then(console.log)
    .catch(console.error);
