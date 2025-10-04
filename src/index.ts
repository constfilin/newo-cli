#!/usr/bin/env npx tsx

import consoleTable     from 'console.table';
import commandLineArgs  from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import objToCsv         from 'objects-to-csv';
import OpenAI           from 'openai';

import config           from './Config';
import {
    sortIfArray
}                       from './utils';

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
            { name: 'command'       ,alias: 'c', type: String    , defaultValue:'help'  ,defaultOption:true, description: "The command to execute" },
            { name: 'stringify'     ,alias: 's', type: Boolean   , defaultValue: false  ,description: "Format output as a JSON string" },
            { name: 'csv'           ,alias: 'v', type: Boolean   , defaultValue: false  ,description: "Format output as a CSV" },
            { name: 'tableColLength',alias: 't', type: Number    , defaultValue: 0      ,description: "Format output as a table, truncating column names to this length (0=off)" },
            { name: 'keepArray'     ,alias: 'k', type: Boolean   , defaultValue: false  ,description: "If not set and the output is an array with a single element, then outputs only this element" },
            { name: 'sortColumn'    ,alias: 'o', type: String    , defaultValue: ''     ,description: "Column name to sort by if output is an array" },
            { name: 'sortDirection' ,alias: 'd', type: Number    , defaultValue: 1      ,description: "Directon to sort by if output is an array (1 or -1)" },
            { name: 'abbreviate'    ,alias: 'b', type: Boolean   , defaultValue: false  ,description: "Abbreviate output (means different things for different commands)" },
            { name: 'columnNames'   ,alias: 'a', type: String    , defaultValue: undefined , description: "Comma-separated list of columns to output, columns will be output in this order" },
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
    const columnNdxByName = argv.columnNames?.split(',').map(s=>s.trim()).filter(s=>s.length>0).reduce( (acc,idn,ndx) => {
        acc[idn] = ndx;
        return acc;
    },{} as Record<string,number>);
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
                                }).catch( e => {
                                    throw Error(`❌ Error calling OpenAI: ${e.message}`);
                                });
                        }));
                    })
                    .then( results => {
                        if( !argv.csv && (argv.tableColLength<=0) ) {
                            // Return raw results because the output is not csv, nor a table
                            return results;
                        }
                        return results.map( r => {
                            return r.items.map( i => {
                                return Object.entries(i)
                                    .filter( ([key,value]) => {
                                        return (key in columnNdxByName)
                                    })
                                    .sort( ([key1,value1],[key2,value2]) => {
                                        return columnNdxByName[key1]-columnNdxByName[key2];
                                    })
                                    .reduce( (acc,[key,value]) => {
                                        acc[key] = value;
                                        return acc;
                                    },{} as Record<string,any>);
                            });
                        });
                    })
            );
        case 'getAttributes': {
            return (
                () => Promise.all(config.customers.map(c=>c.getAttributes(argv)))
                    .then( results => {
                        if( !columnNdxByName ) {
                            // Return raw results because the output is not csv, nor a table
                            if( argv.abreviate )
                                return results.map(r=>r.attributes.map(a => {
                                    return {
                                        idn   : a.idn,
                                        value : argv.tableColLength ? String(a.value).substring(0,argv.tableColLength) : a.value,
                                    }
                                }));
                            return results;
                        }
                        const colNameConverter = (argv.tableColLength) ? (s:string,colNames:Record<string,any>)=> {
                                // Truncate the attribute names but avoid colliding column names
                                s = s.replace(/^project_/,'').replace(/^attributes_/,'').replace(/^setting_/,'').substring(0,argv.tableColLength)
                                while( (s.length>4) && (s in colNames) )
                                    s = s.substring(0,s.length-1);
                                return s;
                            } : (s:string) => {
                                return s;
                            };
                        return results.reduce( (acc,res) => {
                            const line = res.attributes
                                .filter( attr => {
                                    return (attr.idn in columnNdxByName);
                                })
                                .sort( (attr1,attr2) => {
                                    return columnNdxByName[attr1.idn]-columnNdxByName[attr2.idn];
                                })
                                .reduce( (acc2,attr) => {
                                    acc2[colNameConverter(attr.idn,acc2)] = attr.value;
                                    return acc2;
                                },{
                                    IDN : res.profile.idn,
                                } as Record<string,any>);
                            acc.push(line);
                            return acc;
                        },[] as Record<string,any>[]);
                    })
                    .then( results => {
                        // No further processing needed
                        return results;
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

const argv = commandLineArgs(cmdSections.map(s=>s.optionList).filter(ol=>!!ol).flat());
getCmdPromise(argv)
    .then(proc=>proc())
    .then( r => {
        // Final output formatting
        if( Array.isArray(r) && r.length===1 && !argv.keepArray )
            r = r[0];
        if( argv.stringify )
            return JSON.stringify(sortIfArray(r,argv.sortColumn,argv.sortDirection),null,4);
        if( argv.csv )
            return (new objToCsv(Array.isArray(r)?sortIfArray(r,argv.sortColumn,argv.sortDirection):[r])).toString();
        if( argv.tableColLength>0 )
            return consoleTable.getTable(sortIfArray(r,argv.sortColumn,argv.sortDirection));
        return r;
    })
    .then(console.log)
    .catch(console.error);
