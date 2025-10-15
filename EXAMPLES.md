# NEWO CLI

EXAMPLES:

First, the case of many agents configured (NEWO_API_KEY has multiple keys)

1. List certain properties of agents in JSON format
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -a project_business_name,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider,project_representative_agent_voice_phone_number,project_attributes_setting_voice_integration_service_voice_to_voice_provider -s
[
    {
        "IDN": "NE6unlSHpv",
        "project_business_name": "Restaurant #1",
        "project_representative_agent_voice_phone_number": "+61468152302",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    },
    {
        "IDN": "NEWO_DE1LzfkR",
        "project_business_name": "Longwang",
        "project_representative_agent_voice_phone_number": "+61483927022",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    },
    {
        "IDN": "NEWO_z3VEENbq",
        "project_business_name": "Mulga Bill's ",
        "project_representative_agent_voice_phone_number": "+61468012599",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    },
    {
        "IDN": "SMn3Zzoe1x",
        "project_business_name": "Yamas Greek & Drink",
        "project_representative_agent_voice_phone_number": "+61468010964",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    },
    {
        "IDN": "NExMACkKc5",
        "project_business_name": "Pompette Champagne Bar and Restaurant",
        "project_representative_agent_voice_phone_number": "+61468018778",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    },
    {
        "IDN": "NE9erUNfOo",
        "project_business_name": "Massimo Restaurant & Bar",
        "project_representative_agent_voice_phone_number": "+61468010732",
        "project_attributes_setting_voice_integration_service_voice_to_voice_provider": "genai"
    }
]
```

2. List same properties on multiple agents in CSV format
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -c project_business_name,project_representative_agent_voice_phone_number,project_business_name -v
IDN,project_representative_agent_voice_phone_number,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider
NE6unlSHpv,+14081234567,Restaurant #1,openai
NEWO_DE1LzfkR,+14082345671,Restaurant #2,genai
NEWO_z3VEENbq,+14083456712,Dentist #1,openai
SMn3Zzoe1x,+14084567123,Dentist #1,genai
NExMACkKc5,+14085671234,Home Services #1,genai
NE9erUNfOo,+14086712345,Home Services #2,openai
```

3. Same as above but in table format
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -c project_business_name,project_representative_agent_voice_phone_number,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider -t 25
IDN            representative_agent_voic  business_name                          voice_integration_service
-------------  -------------------------  -------------------------------------  -------------------------
NE6unlSHpv     +61468152302               Opa Bar & Mezze                        genai
NEWO_DE1LzfkR  +61483927022               Longwang                               genai
NEWO_z3VEENbq  +61468012599               Mulga Bill's                           genai
SMn3Zzoe1x     +61468010964               Yamas Greek & Drink                    genai
NExMACkKc5     +61468018778               Pompette Champagne Bar and Restaurant  genai
NE9erUNfOo     +61468010732               Massimo Restaurant & Bar               genai
```

4. Same as above but swap columns around
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -c project_business_name,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider,project_representative_agent_voice_phone_number -t 25
IDN            business_name                          voice_integration_service  representative_agent_voic
-------------  -------------------------------------  -------------------------  -------------------------
NE6unlSHpv     Opa Bar & Mezze                        genai                      +61468152302
NEWO_DE1LzfkR  Longwang                               genai                      +61483927022
NEWO_z3VEENbq  Mulga Bill's                           genai                      +61468012599
SMn3Zzoe1x     Yamas Greek & Drink                    genai                      +61468010964
NExMACkKc5     Pompette Champagne Bar and Restaurant  genai                      +61468018778
NE9erUNfOo     Massimo Restaurant & Bar               genai                      +61468010732
```

5. Same as above but sort by IDN
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -c project_business_name,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider,project_representative_agent_voice_phone_number -t 25 --sortColumn IDN --sortDirection 1
IDN            business_name                          voice_integration_service  representative_agent_voic
-------------  -------------------------------------  -------------------------  -------------------------
NE6unlSHpv     Opa Bar & Mezze                        genai                      +61468152302
NE9erUNfOo     Massimo Restaurant & Bar               genai                      +61468010732
NEWO_DE1LzfkR  Longwang                               genai                      +61483927022
NEWO_z3VEENbq  Mulga Bill's                           genai                      +61468012599
NExMACkKc5     Pompette Champagne Bar and Restaurant  genai                      +61468018778
SMn3Zzoe1x     Yamas Greek & Drink                    genai                      +61468010964
```

5. Same as above but sort by IDN in descending order
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getAttributes -i -c project_business_name,project_business_name,project_attributes_setting_voice_integration_service_voice_to_voice_provider,project_representative_agent_voice_phone_number -t 25 --sortColumn IDN --sortDirection -1
IDN            business_name                          voice_integration_service  representative_agent_voic
-------------  -------------------------------------  -------------------------  -------------------------
SMn3Zzoe1x     Yamas Greek & Drink                    genai                      +61468010964
NExMACkKc5     Pompette Champagne Bar and Restaurant  genai                      +61468018778
NEWO_z3VEENbq  Mulga Bill's                           genai                      +61468012599
NEWO_DE1LzfkR  Longwang                               genai                      +61483927022
NE9erUNfOo     Massimo Restaurant & Bar               genai                      +61468010732
NE6unlSHpv     Opa Bar & Mezze                        genai                      +61468152302
```

Now, in case of single agent configuration we can list multiple sessions

1. Just list sessions
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getSessions -c created_at,session_id,contact,session_type --sortColumn created_at --sortDirection -1 -t 20
created_at                  session_id                            contact         session_type                  
--------------------------  ------------------------------------  --------------  ------------------------------
2025-09-25T14:47:44.952000  0368cdac-5896-4e18-909d-67d367a7e42f  User                                          
2025-09-25T00:19:48.753000  cf385d92-f440-4092-9045-463c830ce8c8  User            Other type of session         
2025-09-24T19:14:35.887000  407a6ac3-5744-40c0-b9a5-439f48c754df                                                
2025-09-24T19:07:08.451000  ce8b3374-ec93-4ebd-ae18-ba7ad157d279                                                
2025-09-23T01:31:43.857000  0dd39bd2-d708-4dc4-a06c-f97ff1d1488f  juli                                          
2025-09-23T01:23:04.749000  fee248ca-e5df-4f15-ae9d-0fee52c25dbf  User            [T] Manager or Human Request  
2025-09-23T01:08:28.278000  d5ce1ed9-a43d-44de-98af-44d75e23337b  User            Test Session                  
2025-09-23T01:04:08.595000  2bff9c66-8628-4c57-ae90-9a07e8a6009c  User            General Information Request   
2025-09-22T14:21:36.966000  27861d6c-fd70-475f-a2fe-6f75f6ed320d  User            General Information Request   
2025-09-22T10:42:14.832000  676c5422-ce1b-4817-88bf-8215e2b5631f  User            General Information Request   
2025-09-22T08:59:57.053000  c312c52a-82b8-4cf2-8a9c-a5279f07b69d  User            General Information Request   
2025-09-22T08:25:27.972000  59d39446-7369-4c20-b8a6-864a2895380f  User            Other type of session         
2025-09-22T08:12:15.303000  3183fe8e-9a22-4522-a3b2-2efd2e44a2d0  User            General Information Request 
```

2. Same as above but sort by session type
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getSessions -c created_at,session_id,contact,session_type --sortColumn session_type --sortDirection -1 -t 30
created_at                  session_id                      contact          session_type                  
--------------------------  ------------------------------  ---------------  ------------------------------
2025-10-15T01:38:57.747000  5cd7103b-7132-46eb-b056-2eea33  User             [T] Reschedule or Modification
2025-10-14T19:40:41.335000  208996a5-6d42-450a-a497-960869  User             [T] Manager or Human Request  
2025-10-15T22:49:38.007000  3300332e-d4ef-4edb-b637-925584  User             [T] Guest Support             
2025-10-15T22:36:46.445000  ce32cb5c-768b-44a7-bf47-9f908f  User             [T] Guest Support             
2025-10-15T18:46:23.316000  87f49a12-325d-4c45-b4e4-b70914  Jamie Poley      [T] Contractor Support        
2025-10-15T19:26:02.958000  3a94fac8-5238-4702-9a33-450f0d  User             [L] Regular Table Booking     
2025-10-15T01:36:06.870000  41f5391f-72e1-403c-8ce9-e90eee  User             [L] Regular Table Booking     
2025-10-15T00:46:16.246000  a8fac1ab-5a30-4dcd-a6e4-ecb449  User             [L] Regular Table Booking     
2025-10-15T22:34:57.005000  9d16cf22-6340-4944-b429-404a4a  User             [L] Food order                
2025-10-15T22:12:38.965000  2f1c6421-5241-4b53-a444-7a82c9  User             [L] Food order                
```

3. Same as above buy in CSV format
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getSessions -c created_at,session_id,contact,session_type --sortColumn session_type --sortDirection -1 -v
created_at,session_id,contact,session_type
2025-10-15T01:38:57.747000,5cd7103b-7132-46eb-b056-2eea33fba886,User,[T] Reschedule or Modification
2025-10-14T19:40:41.335000,208996a5-6d42-450a-a497-96086970765c,User,[T] Manager or Human Request
2025-10-15T22:49:38.007000,3300332e-d4ef-4edb-b637-925584b8da7a,User,[T] Guest Support
2025-10-15T22:36:46.445000,ce32cb5c-768b-44a7-bf47-9f908f1148df,User,[T] Guest Support
2025-10-15T18:46:23.316000,87f49a12-325d-4c45-b4e4-b70914eb14de,Jamie Poley,[T] Contractor Support
2025-10-15T19:26:02.958000,3a94fac8-5238-4702-9a33-450f0d4124ad,User,[L] Regular Table Booking
2025-10-15T01:36:06.870000,41f5391f-72e1-403c-8ce9-e90eee53cdd7,User,[L] Regular Table Booking
2025-10-15T00:46:16.246000,a8fac1ab-5a30-4dcd-a6e4-ecb449a9e38b,User,[L] Regular Table Booking
2025-10-15T22:34:57.005000,9d16cf22-6340-4944-b429-404a4ac88952,User,[L] Food order
2025-10-15T22:12:38.965000,2f1c6421-5241-4b53-a444-7a82c90c57af,User,[L] Food order
```
4. Complete dump of session in JSON
```bash
$ LOG_LEVEL=0 npx tsx src/index.ts getSessions --sortColumn session_type --sortDirection -1 -s
// 5000 lines of JSON dump go here, it contains all columns and values
```