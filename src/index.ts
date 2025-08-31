#!/usr/bin/env npx tsx

import commandLineArgs  from 'command-line-args'; 

import Config           from './Config';
import Client           from './Client';

const argv = commandLineArgs([
    { name: 'command',      alias: 'c', type: String, defaultValue: 'help', defaultOption: true },
    { name: 'logLevel',     alias: 'l', type: Number, defaultValue: 2 },
    { name: 'projectId',    alias: 'p', type: String, defaultValue: '' },
    { name: 'includeHidden',alias: 'i', type: Boolean, defaultValue: true },
    { name: 'attributeIdns',alias: 'a', type: String, defaultValue: '' },
    { name: 'stringify',    alias: 's', type: Boolean },
]);

const getCmdPromise = async ( argv:Record<string,any> ) : Promise<() => any> => {
    const config = new Config(argv.logLevel);
    if( argv.command==='help' )
        return () => {
            console.log(`NEWO CLI
Usage:
    newo listProjects               # list all accessible projects
    newo getCustomerProfile         # get customer profile
    newo getCustomerAttrs           # get project attributes (requires -p)
    newo getProject                 # get project (requires -p)

Common Flags:
    --logLevel, -l                  # verobsity level 0..3 (default: 2)
    --stringify, -s                 # output result as JSON string

getProject Flags:
    --projectId, -p                 # project Id (getProject only)

getCustomerAttrs Flags:
    --includeHidden, -i             # include hidden attributes
    --attributeIdns, -a             # optional comma-separated list of attribute IDNs to fetch
Env:
    NEWO_BASE_URL                   # optional, default is https://app.newo.ai
    NEWO_API_KEY or NEWO_API_KEYS   # required, comma-separated list of API keys
`);
    };
    const clients = await Promise.all(config.customers.map( c => {
        return c.getClient(config)
            .then( client => {
                config.log(2, `✓ Client initialized for customer with API key ending in ...${c.api_key.slice(-4)}`);
                return client;
            })
            .catch( e => {
                throw Error(`❌ Error initializing client for customer with API key ending in ...${c.api_key.slice(-4)}: ${e.message}`);
            });
    })) as Client[];
    config.log(1, `✓ Clients initialized for ${clients.length} customer(s)`);
    switch( argv.command ) {
        case 'listProjects':
            return (() => Promise.all(clients.map(c=>c.listProjects())));
        case 'getProject':
            return (() => Promise.all(clients.map(c=>c.getProject(argv.projectId))));
        case 'getCustomerProfile':
            return (() => Promise.all(clients.map(c=>c.getCustomerProfile())));
        case 'getCustomerAttrs': {
            const attributeIdns = argv.attributeIdns ? argv.attributeIdns.split(',').map(s=>s.trim()).filter(s=>s.length>0) : [];
            return (() => Promise.all(clients.map( async ( c ) => {
                const [profile,attrs] = await Promise.all([
                    c.getCustomerProfile(),
                    c.getCustomerAttrs(argv.includeHidden).then( attrs => {
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
                        .map( a => {
                            return {
                                id      : a.id,
                                idn     : a.idn,
                                value   : a.value,
                            };
                        })
                };
            })));
        }
    }
    return (() => {
        throw Error(`Unknown command: '${argv.command}'. Use '${process.argv[1]} -c help' for usage.`);
    });
}
const main = async () => {
    return getCmdPromise(argv).then(proc=>proc());
}

main().then( r => {
    if( argv.stringify )
        console.log(JSON.stringify(r,null,4));
    else
        console.log(r);
    process.exit(0);
}).catch(console.error);
