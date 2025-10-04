# NEWO CLI

Mass reading attributes of NEWO agents

## Install
```bash
# Clone the repository
git clone https://github.com/constfilin/newo-cli.git
cd newo-cli
npm i
```

## Configure

### Step 1: Get Your NEWO API Key
1. **Login** to your [app.newo.ai](https://app.newo.ai) account
2. **Navigate** to the **Integrations** page
3. **Find** the **API Integration** in the list
4. **Create** a new **Connector** for this Integration
5. **Copy** your API key (it will look like: `458663bd41f2d1...`)

Repeat the above for each project you want to read from

![How to get your NEWO API Key](assets/newo-api-key.png)

### Step 2: Setup Environment
```bash
cp .env.example .env
# Edit .env with your values
```

Required environment variables:
- `NEWO_BASE_URL` (default `https://app.newo.ai`)
- `NEWO_API_KEYS` (your API keys from Step 1 separated by comma)

## Command line
```
NEWO CLI

  Command line interface to NEWO. Configuration is read from environment        
  variables or .env file.                                                       

Commands

  help                   Show this help message                          
  pullProjects           Pull projects for all customers                 
  listProjectMetas       List metadata of all projects for all customers 
  getProject             Get details of a specific project               
  getCustomerProfile     Get profile information for all customers       
  getAttributes          Get customer attributes for all customers       
  getCustomerAcctLinks   Get customer account links for all customers    
  getSessions            Get sessions for all customers                  

General options

  -c, --command string          The command to execute                          
  -s, --stringify               Format output as a JSON string                  
  -v, --csv                     Format output as a CSV                          
  -t, --tableColLength number   Format output as a table, truncating column     
                                names to this length (0=off)                    
  -k, --keepArray               If not set and the output is an array with a    
                                single element, then outputs only this element  
  -o, --sortColumn string       Column name to sort by if output is an array    
  -d, --sortDirection number    Directon to sort by if output is an array (1 or 
                                -1)                                             
  -b, --abbreviate              Abbreviate output (means different things for   
                                different commands)                             
  -a, --columnNames string      Comma-separated list of columns to output,      
                                columns will be output in this order            

getProject command options

  -p, --projectId string   Required. A customer can have many projects 

getAttributes command options

  -i, --includeHidden    Include hidden attributes, optional 

getSessions command options

  -f, --fromDate string      optional                                           
  -u, --toDate string        optional                                           
  -l, --isLead string        optional                                           
  -e, --isTest string        optional                                           
  -n, --connectorId string   optional                                           
  -g, --page number          optional                                           
  -r, --per number           optional                                           
  -z, --openAI               If set, and if the OPENAI_API_KEY environment      
                             variable is set, then uses OpenAI to summarize the 
                             session transcript                                 
```
