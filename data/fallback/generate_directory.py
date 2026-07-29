import json
import csv
import sqlite3
import os

services_data = [
    # CENTRAL GOVERNMENT - IDENTITY
    {
        "service_name": "Aadhaar Services",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Identity Services",
        "official_website": "https://myaadhaar.uidai.gov.in/",
        "description": "Aadhaar download, update, PVC card order, and enrollment center search.",
        "government_fee": "Rs. 50 (Updates)",
        "recommended_service_charge": "Rs. 50 - 100",
        "eligibility": "Indian Residents",
        "application_process": "Online or Aadhaar Seva Kendra",
        "required_documents": "POI, POA, DOB Documents",
        "authorization_required": "None (Online) / Aadhaar Operator (Kendra)",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": True,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "PAN Card Services (NSDL/Protean)",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Identity Services",
        "official_website": "https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html",
        "description": "New PAN card application, correction, and reprint.",
        "government_fee": "Rs. 107",
        "recommended_service_charge": "Rs. 50 - 100",
        "eligibility": "Indian Citizens, NRIs, Entities",
        "application_process": "Online with Aadhaar eSign or physical document submission",
        "required_documents": "Aadhaar, Photo, Signature",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "Voter ID (NVSP/ECI)",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Identity Services",
        "official_website": "https://voters.eci.gov.in/",
        "description": "New voter ID registration, correction, EPIC download.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 50",
        "eligibility": "Indian Citizens above 18 years",
        "application_process": "Online via portal",
        "required_documents": "Aadhaar, Passport size photo",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "Passport Seva",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Identity Services",
        "official_website": "https://www.passportindia.gov.in/",
        "description": "Fresh passport, renewal, Police Clearance Certificate (PCC).",
        "government_fee": "Rs. 1500 (Normal)",
        "recommended_service_charge": "Rs. 100 - 200",
        "eligibility": "Indian Citizens",
        "application_process": "Online application followed by PSK visit",
        "required_documents": "Aadhaar, 10th Marks card, PAN",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # CENTRAL GOVERNMENT - TAX
    {
        "service_name": "Income Tax e-Filing",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Tax Services",
        "official_website": "https://www.incometax.gov.in/iec/foportal/",
        "description": "ITR filing, PAN-Aadhaar link, e-Verification, TDS details.",
        "government_fee": "Free (except late fees)",
        "recommended_service_charge": "Rs. 300 - 1000",
        "eligibility": "Taxpayers",
        "application_process": "Online",
        "required_documents": "PAN, Aadhaar, Form 16, Bank Statements",
        "authorization_required": "None / CA for audit",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # CENTRAL GOVERNMENT - LABOUR & PF
    {
        "service_name": "EPFO Member Portal",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Labour Services",
        "official_website": "https://unifiedportal-mem.epfindia.gov.in/memberinterface/",
        "description": "UAN activation, PF withdrawal, transfer, KYC update.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 100 - 200",
        "eligibility": "Salaried employees with PF",
        "application_process": "Online via portal",
        "required_documents": "UAN, Aadhaar, PAN, Bank Passbook",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "eShram Portal",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Labour Services",
        "official_website": "https://eshram.gov.in/",
        "description": "Registration for unorganized sector workers.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 50",
        "eligibility": "Unorganized workers aged 16-59",
        "application_process": "Online self-registration or via CSC",
        "required_documents": "Aadhaar, Aadhaar linked mobile, Bank details",
        "authorization_required": "None / CSC",
        "csc_required": True,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # CENTRAL GOVERNMENT - BUSINESS
    {
        "service_name": "Udyam Registration",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Business Services",
        "official_website": "https://udyamregistration.gov.in/",
        "description": "MSME registration for small and medium enterprises.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 200 - 500",
        "eligibility": "Micro, Small, Medium Enterprises",
        "application_process": "Online via portal",
        "required_documents": "Aadhaar, PAN, GST (optional), Bank details",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "GST Portal",
        "service_category": "CENTRAL GOVERNMENT SERVICES",
        "sub_category": "Business Services",
        "official_website": "https://www.gst.gov.in/",
        "description": "GST registration, return filing, and payments.",
        "government_fee": "Free for registration",
        "recommended_service_charge": "Rs. 500 - 1500",
        "eligibility": "Businesses crossing threshold or voluntarily",
        "application_process": "Online via portal",
        "required_documents": "PAN, Aadhaar, Business Address Proof, Bank details",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # KARNATAKA GOVERNMENT - REVENUE & LAND
    {
        "service_name": "Nadakacheri",
        "service_category": "KARNATAKA GOVERNMENT SERVICES",
        "sub_category": "Revenue Department",
        "official_website": "https://nadakacheri.karnataka.gov.in/",
        "description": "Income, Caste, Residence certificates, and pensions.",
        "government_fee": "Rs. 25 - 40",
        "recommended_service_charge": "Rs. 50 - 100",
        "eligibility": "Residents of Karnataka",
        "application_process": "Online or via Nadakacheri centers",
        "required_documents": "Aadhaar, Ration Card, School records (for caste)",
        "authorization_required": "None (Online) / Grama One",
        "csc_required": False,
        "grama_one_required": True,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "Bhoomi (Land Records)",
        "service_category": "KARNATAKA GOVERNMENT SERVICES",
        "sub_category": "Revenue Department",
        "official_website": "https://landrecords.karnataka.gov.in/",
        "description": "RTC, Pahani, Mutation, Survey details.",
        "government_fee": "Rs. 15 for digital RTC",
        "recommended_service_charge": "Rs. 30 - 50",
        "eligibility": "Landowners in Karnataka",
        "application_process": "Online viewing and downloading",
        "required_documents": "Survey Number, Hissa Number",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # KARNATAKA GOVERNMENT - CITIZEN
    {
        "service_name": "Seva Sindhu",
        "service_category": "KARNATAKA GOVERNMENT SERVICES",
        "sub_category": "Citizen Services",
        "official_website": "https://sevasindhu.karnataka.gov.in/",
        "description": "Integrated portal for delivery of citizen services of Karnataka Government including guarantee schemes.",
        "government_fee": "Varies",
        "recommended_service_charge": "Rs. 50 - 100",
        "eligibility": "Residents of Karnataka",
        "application_process": "Online portal or Grama One",
        "required_documents": "Aadhaar, Ration Card",
        "authorization_required": "None / Grama One",
        "csc_required": False,
        "grama_one_required": True,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # JOB PORTALS - CENTRAL
    {
        "service_name": "UPSC (Union Public Service Commission)",
        "service_category": "JOB PORTALS",
        "sub_category": "CENTRAL GOVERNMENT JOBS",
        "official_website": "https://upsc.gov.in/",
        "description": "Recruitment for Civil Services, NDA, CDS, etc.",
        "government_fee": "Rs. 100 (varies by category)",
        "recommended_service_charge": "Rs. 100 - 150",
        "eligibility": "Varies by exam",
        "application_process": "Online via upsconline.nic.in",
        "required_documents": "Photo, Signature, ID Proof, Educational Docs",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "SSC (Staff Selection Commission)",
        "service_category": "JOB PORTALS",
        "sub_category": "CENTRAL GOVERNMENT JOBS",
        "official_website": "https://ssc.nic.in/",
        "description": "Recruitment for CGL, CHSL, MTS, GD Constable.",
        "government_fee": "Rs. 100 (Exempt for Women/SC/ST)",
        "recommended_service_charge": "Rs. 100",
        "eligibility": "10th/12th/Degree based on post",
        "application_process": "Online via portal",
        "required_documents": "Photo, Signature, Educational Docs",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # JOB PORTALS - KARNATAKA
    {
        "service_name": "KPSC (Karnataka Public Service Commission)",
        "service_category": "JOB PORTALS",
        "sub_category": "KARNATAKA GOVERNMENT JOBS",
        "official_website": "https://kpsc.kar.nic.in/",
        "description": "Recruitment for state civil services and department posts.",
        "government_fee": "Rs. 300-600",
        "recommended_service_charge": "Rs. 100 - 200",
        "eligibility": "Degree/Diploma/PUC + Kannada knowledge",
        "application_process": "Online via portal",
        "required_documents": "Photo, Signature, Caste Certificate, Educational Docs",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    
    # SCHOLARSHIPS
    {
        "service_name": "National Scholarship Portal (NSP)",
        "service_category": "SCHOLARSHIPS",
        "sub_category": "Central Government Scholarships",
        "official_website": "https://scholarships.gov.in/",
        "description": "Centralized portal for all national level scholarships.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 100",
        "eligibility": "Students as per specific scheme criteria",
        "application_process": "Online via portal",
        "required_documents": "Aadhaar, Bonafide certificate, Bank Account, Income certificate",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "State Scholarship Portal (SSP Karnataka)",
        "service_category": "SCHOLARSHIPS",
        "sub_category": "State Government Scholarships",
        "official_website": "https://ssp.postmatric.karnataka.gov.in/",
        "description": "Post-matric and Pre-matric scholarships for Karnataka students.",
        "government_fee": "Free",
        "recommended_service_charge": "Rs. 100",
        "eligibility": "Students in Karnataka",
        "application_process": "Online via portal",
        "required_documents": "SATS ID, Aadhaar, Income/Caste Certificate (Nadakacheri)",
        "authorization_required": "None",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },

    # TRAVEL SERVICES
    {
        "service_name": "IRCTC",
        "service_category": "TRAVEL SERVICES",
        "sub_category": "RAIL",
        "official_website": "https://www.irctc.co.in/",
        "description": "Official Indian Railways ticket booking portal.",
        "government_fee": "Ticket Fare",
        "recommended_service_charge": "Rs. 50 - 100 per ticket",
        "eligibility": "General Public",
        "application_process": "Online booking",
        "required_documents": "ID Proof for travel",
        "authorization_required": "IRCTC Agent License (for commercial booking)",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    },
    {
        "service_name": "KSRTC",
        "service_category": "TRAVEL SERVICES",
        "sub_category": "BUS",
        "official_website": "https://ksrtc.in/",
        "description": "Karnataka State Road Transport Corporation online booking.",
        "government_fee": "Ticket Fare",
        "recommended_service_charge": "Rs. 30 - 50 per ticket",
        "eligibility": "General Public",
        "application_process": "Online booking",
        "required_documents": "ID Proof for travel",
        "authorization_required": "None / Franchise for commercial",
        "csc_required": False,
        "grama_one_required": False,
        "aadhaar_operator_required": False,
        "last_verified_date": "2024-06-16",
        "portal_status": "Active"
    }
]

def generate_json():
    with open('dataset.json', 'w') as f:
        json.dump(services_data, f, indent=4)
    print("Generated dataset.json")

def generate_csv():
    if not services_data: return
    keys = services_data[0].keys()
    with open('dataset.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(services_data)
    print("Generated dataset.csv")

def generate_sql():
    # Write the schema
    sql_schema = """CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE sub_categories (
    sub_category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    sub_category_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE services (
    service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name VARCHAR(255) NOT NULL,
    sub_category_id INTEGER,
    official_website VARCHAR(255) NOT NULL,
    description TEXT,
    government_fee VARCHAR(100),
    recommended_service_charge VARCHAR(100),
    eligibility TEXT,
    application_process TEXT,
    required_documents TEXT,
    authorization_required VARCHAR(255) DEFAULT 'None',
    csc_required BOOLEAN DEFAULT 0,
    grama_one_required BOOLEAN DEFAULT 0,
    aadhaar_operator_required BOOLEAN DEFAULT 0,
    last_verified_date DATE,
    portal_status VARCHAR(50),
    FOREIGN KEY (sub_category_id) REFERENCES sub_categories(sub_category_id)
);

"""
    with open('database.sql', 'w', encoding='utf-8') as f:
        f.write(sql_schema)
        
        # We need to insert categories and subcategories first
        cats = {}
        subcats = {}
        
        cat_id = 1
        subcat_id = 1
        
        for s in services_data:
            c = s['service_category']
            sc = s['sub_category']
            
            if c not in cats:
                f.write(f"INSERT INTO categories (category_id, category_name) VALUES ({cat_id}, '{c}');\\n")
                cats[c] = cat_id
                cat_id += 1
                
            c_id = cats[c]
            
            if sc not in subcats:
                f.write(f"INSERT INTO sub_categories (sub_category_id, category_id, sub_category_name) VALUES ({subcat_id}, {c_id}, '{sc}');\\n")
                subcats[sc] = subcat_id
                subcat_id += 1
                
        # Insert services
        for s in services_data:
            sc_id = subcats[s['sub_category']]
            f.write("INSERT INTO services (service_name, sub_category_id, official_website, description, government_fee, recommended_service_charge, eligibility, application_process, required_documents, authorization_required, csc_required, grama_one_required, aadhaar_operator_required, last_verified_date, portal_status) VALUES ")
            vals = (
                s['service_name'], sc_id, s['official_website'], s['description'], s['government_fee'],
                s['recommended_service_charge'], s['eligibility'], s['application_process'], s['required_documents'],
                s['authorization_required'], 1 if s['csc_required'] else 0, 1 if s['grama_one_required'] else 0,
                1 if s['aadhaar_operator_required'] else 0, s['last_verified_date'], s['portal_status']
            )
            val_str = ", ".join([f"'{str(v).replace(chr(39), chr(39)+chr(39))}'" if isinstance(v, str) else str(v) for v in vals])
            f.write(f"({val_str});\\n")
            
    print("Generated database.sql")

def generate_markdowns():
    docs_dir = 'docs'
    os.makedirs(docs_dir, exist_ok=True)
    
    # Sitemap
    with open('sitemap.md', 'w') as f:
        f.write("# Kalpan Enterprises Portal Sitemap\\n\\n")
        cats = {}
        for s in services_data:
            cats.setdefault(s['service_category'], {}).setdefault(s['sub_category'], []).append(s)
            
        for c, scs in cats.items():
            f.write(f"## {c}\\n")
            for sc, svcs in scs.items():
                f.write(f"### {sc}\\n")
                for svc in svcs:
                    f.write(f"- [{svc['service_name']}]({svc['official_website']})\\n")
    print("Generated sitemap.md")
    
    # Category Structure
    with open('category_structure.md', 'w') as f:
        f.write("# Category Structure\\n\\n")
        for c, scs in cats.items():
            f.write(f"- **{c}**\\n")
            for sc in scs:
                f.write(f"  - {sc}\\n")
    print("Generated category_structure.md")

    # Directories
    def write_directory(title, filename, category_filter=None):
        with open(os.path.join(docs_dir, filename), 'w') as f:
            f.write(f"# {title}\\n\\n")
            for s in services_data:
                if category_filter and s['service_category'] not in category_filter:
                    continue
                f.write(f"## {s['service_name']}\\n")
                f.write(f"- **Category:** {s['service_category']} > {s['sub_category']}\\n")
                f.write(f"- **Website:** [{s['official_website']}]({s['official_website']})\\n")
                f.write(f"- **Description:** {s['description']}\\n")
                f.write(f"- **Govt Fee:** {s['government_fee']} | **Service Charge:** {s['recommended_service_charge']}\\n")
                f.write(f"- **Required Docs:** {s['required_documents']}\\n")
                f.write(f"- **Authorization:** {s['authorization_required']}\\n\\n")
                
    write_directory("Verified Service Directory", "service_directory.md")
    write_directory("Job Portals Directory", "job_directory.md", ["JOB PORTALS"])
    write_directory("Scholarship Portals Directory", "scholarship_directory.md", ["SCHOLARSHIPS"])
    write_directory("Travel Services Directory", "travel_directory.md", ["TRAVEL SERVICES"])
    
    # Verified Portals (all)
    write_directory("All Verified Portals", "verified_portals.md")

    print("Generated all markdown directories")

if __name__ == '__main__':
    generate_json()
    generate_csv()
    generate_sql()
    generate_markdowns()
    print("Data generation complete.")
