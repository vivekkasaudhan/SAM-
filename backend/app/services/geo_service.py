"""
Geographic Hierarchy Foundation for AquaSense.
Supports Country -> State -> District -> City hierarchy.
Provides normalized location handling, rich geographic dataset lookup,
and database-integrated cascading geographic retrieval.
"""

from typing import List, Dict, Any, Optional
import math
from sqlalchemy.orm import Session
from sqlalchemy import func


# ─── Reference Geographic Dataset ─────────────────────────────────────────────
# Hierarchical structure: Country -> State -> District -> [Cities]
GEO_REFERENCE_DATA: Dict[str, Dict[str, Dict[str, List[str]]]] = {
    "India": {
        "Jharkhand": {
            "East Singhbhum": [
                "Jamshedpur",
                "Ghatshila",
                "Musabani",
                "Chakulia",
                "Baharagora",
                "Potka",
                "Dhalbhumgarh",
            ],
            "West Singhbhum": [
                "Chaibasa",
                "Chakradharpur",
                "Kiriburu",
                "Jagannathpur",
                "Noamundi",
            ],
            "Seraikela Kharsawan": [
                "Adityapur",
                "Seraikela",
                "Chandil",
                "Gamharia",
                "Kharsawan",
            ],
            "Ranchi": [
                "Ranchi",
                "Kanke",
                "Namkum",
                "Hatia",
                "Bundu",
                "Ormanjhi",
            ],
            "Dhanbad": [
                "Dhanbad",
                "Jharia",
                "Sindri",
                "Katras",
                "Chirkunda",
            ],
            "Bokaro": [
                "Bokaro Steel City",
                "Chas",
                "Bermo",
                "Phusro",
                "Gomia",
            ],
            "Deoghar": [
                "Deoghar",
                "Madhupur",
                "Jasidih",
            ],
            "Hazaribagh": [
                "Hazaribagh",
                "Barhi",
                "Barkagaon",
            ],
            "Ramgarh": [
                "Ramgarh Cantonment",
                "Patratu",
                "Gola",
            ],
            "Giridih": [
                "Giridih",
                "Dumri",
                "Bagodar",
            ],
            "Palamu": [
                "Medininagar (Daltonganj)",
                "Hussainabad",
                "Chhatarpur",
            ],
            "Dumka": [
                "Dumka",
                "Sarath",
                "Jarmaundi",
            ],
            "Garhwa": ["Garhwa", "Majhiaon", "Nagar Untari"],
            "Godda": ["Godda", "Mahagama"],
            "Gumla": ["Gumla", "Chainpur"],
            "Jamtara": ["Jamtara", "Mihijam"],
            "Khunti": ["Khunti", "Torpa"],
            "Koderma": ["Jhumri Telaiya", "Koderma"],
            "Latehar": ["Latehar", "Chandwa"],
            "Lohardaga": ["Lohardaga"],
            "Pakur": ["Pakur"],
            "Sahibganj": ["Sahibganj", "Rajmahal"],
            "Simdega": ["Simdega"],
        },
        "West Bengal": {
            "Kolkata": ["Kolkata", "Alipore", "Ballygunge"],
            "Howrah": ["Howrah", "Bally", "Uluberia"],
            "North 24 Parganas": ["Barasat", "Barrackpore", "Bidhannagar"],
            "South 24 Parganas": ["Alipore", "Baruipur", "Canning"],
            "Darjeeling": ["Darjeeling", "Siliguri", "Kurseong"],
            "Paschim Bardhaman": ["Asansol", "Durgapur"],
            "Purba Bardhaman": ["Bardhaman", "Katwa", "Kalna"],
            "Nadia": ["Krishnanagar", "Kalyani", "Ranaghat"],
            "Murshidabad": ["Baharampur", "Jangipur"],
            "Hooghly": ["Chinsurah", "Serampore", "Chandannagar"],
        },
        "Bihar": {
            "Patna": ["Patna", "Danapur", "Phulwari Sharif"],
            "Gaya": ["Gaya", "Bodh Gaya", "Sherghati"],
            "Muzaffarpur": ["Muzaffarpur", "Motipur", "Kanti"],
            "Bhagalpur": ["Bhagalpur", "Kahalgon", "Naugachia"],
            "Darbhanga": ["Darbhanga", "Benipur"],
            "Purnia": ["Purnia", "Banmankhi"],
            "Begusarai": ["Begusarai", "Barauni"],
        },
        "Odisha": {
            "Khordha": ["Bhubaneswar", "Khordha", "Jatni"],
            "Cuttack": ["Cuttack", "Choudwar", "Athagarh"],
            "Sundargarh": ["Rourkela", "Sundargarh", "Rajgangpur"],
            "Puri": ["Puri", "Konark", "Pipili"],
            "Ganjam": ["Berhampur", "Chhatrapur"],
            "Sambalpur": ["Sambalpur", "Burla", "Hirakud"],
            "Balasore": ["Balasore", "Jaleswar"],
        },
        "Maharashtra": {
            "Mumbai City": ["Mumbai", "Colaba", "Dadar", "Fort"],
            "Mumbai Suburban": ["Bandra", "Andheri", "Borivali", "Kurla"],
            "Pune": ["Pune", "Pimpri-Chinchwad", "Baramati"],
            "Nagpur": ["Nagpur", "Kamptee", "Umred"],
            "Thane": ["Thane", "Kalyan-Dombivli", "Navi Mumbai", "Mira-Bhayandar"],
            "Nashik": ["Nashik", "Malegaon", "Deolali"],
            "Aurangabad (Chhatrapati Sambhajinagar)": ["Chhatrapati Sambhajinagar", "Paithan"],
        },
        "Delhi": {
            "New Delhi": ["New Delhi", "Connaught Place", "Chanakyapuri"],
            "Central Delhi": ["Karol Bagh", "Paharganj"],
            "South Delhi": ["Saket", "Hauz Khas", "Greater Kailash"],
            "North Delhi": ["Civil Lines", "Sadar Bazar"],
            "East Delhi": ["Preet Vihar", "Mayur Vihar"],
            "West Delhi": ["Rajouri Garden", "Punjabi Bagh"],
        },
        "Karnataka": {
            "Bengaluru Urban": ["Bengaluru", "Whitefield", "Electronic City", "Yelahanka"],
            "Bengaluru Rural": ["Devanahalli", "Doddaballapura", "Hosakote"],
            "Mysuru": ["Mysuru", "Nanjangud", "Hunsur"],
            "Dharwad": ["Hubballi", "Dharwad"],
            "Dakshina Kannada": ["Mangaluru", "Bantwal"],
            "Belagavi": ["Belagavi", "Gokak"],
        },
        "Tamil Nadu": {
            "Chennai": ["Chennai", "Adyar", "T. Nagar", "Anna Nagar"],
            "Coimbatore": ["Coimbatore", "Pollachi", "Mettupalayam"],
            "Madurai": ["Madurai", "Melur"],
            "Tiruchirappalli": ["Tiruchirappalli", "Srirangam"],
            "Salem": ["Salem", "Mettur"],
        },
        "Uttar Pradesh": {
            "Lucknow": ["Lucknow", "Malihabad", "Bakshi Ka Talab"],
            "Kanpur Nagar": ["Kanpur", "Bilhaur", "Ghatampur"],
            "Varanasi": ["Varanasi", "Pindra", "Rohaniya"],
            "Gautam Buddha Nagar": ["Noida", "Greater Noida", "Dadri"],
            "Agra": ["Agra", "Fatehabad"],
            "Prayagraj": ["Prayagraj", "Phulpur"],
        },
        "Gujarat": {
            "Ahmedabad": ["Ahmedabad", "Sanand", "Dholka"],
            "Surat": ["Surat", "Bardoli", "Kamrej"],
            "Vadodara": ["Vadodara", "Padra"],
            "Rajkot": ["Rajkot", "Gondal"],
        },
        "Telangana": {
            "Hyderabad": ["Hyderabad", "Secunderabad", "Charminar"],
            "Rangareddy": ["Shamshabad", "Rajendranagar", "Serilingampally"],
            "Medchal-Malkajgiri": ["Malkajgiri", "Kukatpally", "Medchal"],
            "Warangal": ["Warangal", "Hanamkonda"],
        },
        "Rajasthan": {
            "Jaipur": ["Jaipur", "Amber", "Sanganer"],
            "Jodhpur": ["Jodhpur", "Bilara", "Piparcity"],
            "Udaipur": ["Udaipur", "Mavli"],
            "Kota": ["Kota", "Ramganj Mandi"],
        },
        "Kerala": {
            "Thiruvananthapuram": ["Thiruvananthapuram", "Nedumangad", "Neyyattinkara"],
            "Ernakulam": ["Kochi", "Aluva", "Angamaly"],
            "Kozhikode": ["Kozhikode", "Vadakara"],
        },
        "Punjab": {
            "Amritsar": ["Amritsar", "Ajnala", "Baba Bakala"],
            "Ludhiana": ["Ludhiana", "Jagraon", "Khanna"],
            "Jalandhar": ["Jalandhar", "Nakodar"],
        },
        "Haryana": {
            "Gurugram": ["Gurugram", "Sohna", "Pataudi"],
            "Faridabad": ["Faridabad", "Ballabhgarh"],
            "Ambala": ["Ambala", "Barara"],
        },
        "Madhya Pradesh": {
            "Bhopal": ["Bhopal", "Berasia"],
            "Indore": ["Indore", "Mhow", "Sanwer"],
            "Gwalior": ["Gwalior", "Dabra"],
            "Jabalpur": ["Jabalpur", "Sihora"],
        },
        "Assam": {
            "Kamrup Metropolitan": ["Guwahati", "Dispur"],
            "Dibrugarh": ["Dibrugarh", "Chabua"],
            "Cachar": ["Silchar"],
        },
        "Andhra Pradesh": {
            "Visakhapatnam": ["Visakhapatnam", "Anakapalle", "Bheemunipatnam"],
            "Krishna": ["Vijayawada", "Machilipatnam"],
            "Guntur": ["Guntur", "Tenali"],
        },
    },
    "United States": {
        "California": {
            "Los Angeles": ["Los Angeles", "Long Beach", "Pasadena", "Glendale"],
            "San Francisco": ["San Francisco"],
            "Santa Clara": ["San Jose", "Palo Alto", "Santa Clara", "Sunnyvale"],
            "San Diego": ["San Diego", "Chula Vista", "Oceanside"],
            "Orange": ["Anaheim", "Santa Ana", "Irvine"],
        },
        "New York": {
            "New York": ["Manhattan"],
            "Kings": ["Brooklyn"],
            "Queens": ["Queens"],
            "Bronx": ["Bronx"],
            "Richmond": ["Staten Island"],
        },
        "Texas": {
            "Harris": ["Houston", "Pasadena", "Baytown"],
            "Dallas": ["Dallas", "Irving", "Garland"],
            "Travis": ["Austin", "Pflugerville", "Lakeway"],
            "Bexar": ["San Antonio"],
        },
        "Washington": {
            "King": ["Seattle", "Bellevue", "Redmond"],
            "Pierce": ["Tacoma", "Lakewood"],
        },
        "Illinois": {
            "Cook": ["Chicago", "Evanston", "Schaumburg"],
        },
    },
    "United Kingdom": {
        "England": {
            "Greater London": ["London", "Westminster", "Greenwich", "Camden"],
            "Greater Manchester": ["Manchester", "Salford", "Bolton"],
            "West Midlands": ["Birmingham", "Coventry", "Wolverhampton"],
            "Merseyside": ["Liverpool", "Birkenhead"],
            "West Yorkshire": ["Leeds", "Bradford", "Wakefield"],
        },
        "Scotland": {
            "City of Edinburgh": ["Edinburgh"],
            "Glasgow City": ["Glasgow"],
            "Aberdeen City": ["Aberdeen"],
        },
        "Wales": {
            "Cardiff": ["Cardiff"],
            "Swansea": ["Swansea"],
        },
    },
    "Australia": {
        "New South Wales": {
            "Greater Sydney": ["Sydney", "Parramatta", "Penrith"],
            "Hunter": ["Newcastle", "Maitland"],
        },
        "Victoria": {
            "Greater Melbourne": ["Melbourne", "Geelong", "Ballarat"],
        },
        "Queensland": {
            "Brisbane": ["Brisbane"],
            "Gold Coast": ["Gold Coast"],
        },
    },
    "Canada": {
        "Ontario": {
            "Toronto Division": ["Toronto", "North York", "Scarborough"],
            "Ottawa": ["Ottawa"],
            "Peel": ["Mississauga", "Brampton"],
        },
        "British Columbia": {
            "Greater Vancouver": ["Vancouver", "Burnaby", "Richmond", "Surrey"],
            "Capital": ["Victoria"],
        },
        "Quebec": {
            "Montreal": ["Montreal", "Westmount"],
            "Capitale-Nationale": ["Quebec City"],
        },
    },
}


# Known geographical bounding boxes for offline fast matching without remote Nominatim
LOCAL_GEO_BOUNDS = [
    {
        "name": "Jamshedpur Urban Agglomeration",
        "country": "India",
        "state": "Jharkhand",
        "district": "East Singhbhum",
        "city": "Jamshedpur",
        "min_lat": 22.72,
        "max_lat": 22.86,
        "min_lon": 86.10,
        "max_lon": 86.28,
    },
    {
        "name": "Lucknow Metropolitan Area",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Lucknow",
        "city": "Lucknow",
        "min_lat": 26.60,
        "max_lat": 27.10,
        "min_lon": 80.70,
        "max_lon": 81.20,
    },
    {
        "name": "Kanpur Urban Area",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Kanpur Nagar",
        "city": "Kanpur",
        "min_lat": 26.35,
        "max_lat": 26.60,
        "min_lon": 80.20,
        "max_lon": 80.50,
    },
    {
        "name": "Varanasi Urban Area",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Varanasi",
        "city": "Varanasi",
        "min_lat": 25.20,
        "max_lat": 25.45,
        "min_lon": 82.90,
        "max_lon": 83.15,
    },
    {
        "name": "Noida / Greater Noida",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Gautam Buddha Nagar",
        "city": "Noida",
        "min_lat": 28.40,
        "max_lat": 28.65,
        "min_lon": 77.30,
        "max_lon": 77.60,
    },
    {
        "name": "Agra Metropolitan Area",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Agra",
        "city": "Agra",
        "min_lat": 27.10,
        "max_lat": 27.28,
        "min_lon": 77.90,
        "max_lon": 78.15,
    },
    {
        "name": "Prayagraj Urban Area",
        "country": "India",
        "state": "Uttar Pradesh",
        "district": "Prayagraj",
        "city": "Prayagraj",
        "min_lat": 25.35,
        "max_lat": 25.55,
        "min_lon": 81.75,
        "max_lon": 82.00,
    },
    {
        "name": "Ranchi Municipal Area",
        "country": "India",
        "state": "Jharkhand",
        "district": "Ranchi",
        "city": "Ranchi",
        "min_lat": 23.25,
        "max_lat": 23.45,
        "min_lon": 85.20,
        "max_lon": 85.45,
    },
    {
        "name": "Kolkata Metropolitan Area",
        "country": "India",
        "state": "West Bengal",
        "district": "Kolkata",
        "city": "Kolkata",
        "min_lat": 22.45,
        "max_lat": 22.68,
        "min_lon": 88.25,
        "max_lon": 88.48,
    },
    {
        "name": "Delhi NCT",
        "country": "India",
        "state": "Delhi",
        "district": "New Delhi",
        "city": "New Delhi",
        "min_lat": 28.45,
        "max_lat": 28.85,
        "min_lon": 76.90,
        "max_lon": 77.40,
    },
    {
        "name": "Mumbai Metropolitan",
        "country": "India",
        "state": "Maharashtra",
        "district": "Mumbai City",
        "city": "Mumbai",
        "min_lat": 18.88,
        "max_lat": 19.30,
        "min_lon": 72.75,
        "max_lon": 73.05,
    },
    {
        "name": "Bengaluru Urban",
        "country": "India",
        "state": "Karnataka",
        "district": "Bengaluru Urban",
        "city": "Bengaluru",
        "min_lat": 12.80,
        "max_lat": 13.15,
        "min_lon": 77.45,
        "max_lon": 77.75,
    },
    {
        "name": "Bhubaneswar",
        "country": "India",
        "state": "Odisha",
        "district": "Khordha",
        "city": "Bhubaneswar",
        "min_lat": 20.20,
        "max_lat": 20.40,
        "min_lon": 85.75,
        "max_lon": 85.90,
    },
    {
        "name": "Patna",
        "country": "India",
        "state": "Bihar",
        "district": "Patna",
        "city": "Patna",
        "min_lat": 25.50,
        "max_lat": 25.68,
        "min_lon": 85.05,
        "max_lon": 85.25,
    },
]

# Canonical mappings and standard state/country abbreviations
STATE_ALIASES: Dict[str, str] = {
    "up": "Uttar Pradesh",
    "u.p.": "Uttar Pradesh",
    "uttar pradesh": "Uttar Pradesh",
    "mp": "Madhya Pradesh",
    "m.p.": "Madhya Pradesh",
    "madhya pradesh": "Madhya Pradesh",
    "ap": "Andhra Pradesh",
    "a.p.": "Andhra Pradesh",
    "andhra pradesh": "Andhra Pradesh",
    "wb": "West Bengal",
    "w.b.": "West Bengal",
    "west bengal": "West Bengal",
    "tn": "Tamil Nadu",
    "t.n.": "Tamil Nadu",
    "tamil nadu": "Tamil Nadu",
    "mh": "Maharashtra",
    "maharashtra": "Maharashtra",
    "dl": "Delhi",
    "delhi": "Delhi",
    "nct": "Delhi",
    "ka": "Karnataka",
    "karnataka": "Karnataka",
    "jh": "Jharkhand",
    "jharkhand": "Jharkhand",
    "br": "Bihar",
    "bihar": "Bihar",
    "rj": "Rajasthan",
    "rajasthan": "Rajasthan",
    "gj": "Gujarat",
    "gujarat": "Gujarat",
    "od": "Odisha",
    "or": "Odisha",
    "odisha": "Odisha",
    "ts": "Telangana",
    "tg": "Telangana",
    "telangana": "Telangana",
    "kl": "Kerala",
    "kerala": "Kerala",
    "pb": "Punjab",
    "punjab": "Punjab",
    "hr": "Haryana",
    "haryana": "Haryana",
    "as": "Assam",
    "assam": "Assam",
    "uk": "Uttarakhand",
    "ut": "Uttarakhand",
    "uttarakhand": "Uttarakhand",
}

COUNTRY_ALIASES: Dict[str, str] = {
    "in": "India",
    "ind": "India",
    "india": "India",
    "us": "United States",
    "usa": "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    "united states": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
    "u.k.": "United Kingdom",
    "united kingdom": "United Kingdom",
    "great britain": "United Kingdom",
    "gb": "United Kingdom",
    "au": "Australia",
    "aus": "Australia",
    "australia": "Australia",
    "ca": "Canada",
    "can": "Canada",
    "canada": "Canada",
}


def normalize_location_name(val: Optional[str]) -> Optional[str]:
    """
    Consistently normalize location names:
    - Strips leading/trailing whitespace and collapses internal multiple spaces
    - Maps state/country abbreviations (e.g. UP -> Uttar Pradesh, USA -> United States)
    - Returns Title-cased canonical string or None
    """
    if val is None:
        return None
    s = val.strip()
    if not s:
        return None

    # Collapse internal whitespace
    s = " ".join(s.split())
    s_lower = s.lower()

    # Check state aliases first
    if s_lower in STATE_ALIASES:
        return STATE_ALIASES[s_lower]

    # Check country aliases
    if s_lower in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[s_lower]

    # Handle uppercase acronyms
    if s.upper() in {"NCR", "NCT"}:
        return s.upper()

    # Title-case multi-word names cleanly, preserving parentheses or hyphenated words
    parts = s.split()
    normalized_parts = []
    for part in parts:
        if part.startswith("(") and part.endswith(")"):
            inner = part[1:-1].capitalize()
            normalized_parts.append(f"({inner})")
        elif "-" in part:
            subparts = [sp.capitalize() for sp in part.split("-")]
            normalized_parts.append("-".join(subparts))
        else:
            normalized_parts.append(part.capitalize())

    return " ".join(normalized_parts)


def get_state_variants(state_name: Optional[str]) -> List[str]:
    """Return all known aliases and lowercase strings for a state to match reliably in SQL."""
    if not state_name:
        return []
    s = state_name.strip().lower()
    canonical = STATE_ALIASES.get(s, normalize_location_name(state_name) or s)
    variants = {s, canonical.lower()}
    for alias, can in STATE_ALIASES.items():
        if can.lower() == canonical.lower():
            variants.add(alias)
    return list(variants)


def get_country_variants(country_name: Optional[str]) -> List[str]:
    """Return all known aliases and lowercase strings for a country."""
    if not country_name:
        return []
    c = country_name.strip().lower()
    canonical = COUNTRY_ALIASES.get(c, normalize_location_name(country_name) or c)
    variants = {c, canonical.lower()}
    for alias, can in COUNTRY_ALIASES.items():
        if can.lower() == canonical.lower():
            variants.add(alias)
    return list(variants)


def _matches(a: Optional[str], b: Optional[str]) -> bool:
    """Case-insensitive and whitespace-tolerant match."""
    if not a or not b:
        return False
    return a.strip().lower() == b.strip().lower()


class GeoService:
    """
    Cascading geographic service handling:
    Country -> State -> District -> City hierarchy.
    Combines verified geographic reference data with registered database wells.
    """

    def __init__(self):
        self.ref_data = GEO_REFERENCE_DATA

    def get_countries(self, db: Optional[Session] = None) -> List[str]:
        """Return sorted list of all available countries."""
        countries = set(self.ref_data.keys())

        # Include registered countries from active database wells if provided
        if db:
            from app.models.database import Well
            try:
                db_countries = db.query(Well.country).filter(
                    Well.country.isnot(None), Well.is_active == True
                ).distinct().all()
                for (c,) in db_countries:
                    norm = normalize_location_name(c)
                    if norm:
                        countries.add(norm)
            except Exception:
                pass

        # Sort with India first as primary deployment territory, followed alphabetically
        sorted_list = sorted(list(countries))
        if "India" in sorted_list:
            sorted_list.remove("India")
            sorted_list.insert(0, "India")
        return sorted_list

    def get_states(self, country: Optional[str] = None, db: Optional[Session] = None) -> List[str]:
        """Return states for a specific country (defaults to India if omitted)."""
        target_country = normalize_location_name(country) or "India"
        states = set()

        # Find in reference dataset (case-insensitive lookup)
        for c_key, c_val in self.ref_data.items():
            if _matches(c_key, target_country):
                states.update(c_val.keys())
                break

        # Merge with database wells for this country
        if db:
            from app.models.database import Well
            try:
                query = db.query(Well.state).filter(
                    Well.state.isnot(None), Well.is_active == True
                )
                if target_country:
                    query = query.filter(func.lower(Well.country) == target_country.lower())
                for (st,) in query.distinct().all():
                    norm = normalize_location_name(st)
                    if norm:
                        states.add(norm)
            except Exception:
                pass

        return sorted(list(states))

    def get_districts(
        self,
        country: Optional[str] = None,
        state: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> List[str]:
        """Return districts for a state, optionally qualified by country."""
        target_country = normalize_location_name(country) or "India"
        target_state = normalize_location_name(state)
        districts = set()

        if not target_state:
            return []

        # Find in reference dataset
        for c_key, c_val in self.ref_data.items():
            if target_country and not _matches(c_key, target_country):
                continue
            for s_key, s_val in c_val.items():
                if _matches(s_key, target_state):
                    districts.update(s_val.keys())
                    break

        # Merge with database wells
        if db:
            from app.models.database import Well
            try:
                query = db.query(Well.district).filter(
                    Well.district.isnot(None),
                    func.lower(Well.state) == target_state.lower(),
                    Well.is_active == True,
                )
                if target_country:
                    query = query.filter(func.lower(Well.country) == target_country.lower())
                for (d,) in query.distinct().all():
                    norm = normalize_location_name(d)
                    if norm:
                        districts.add(norm)
            except Exception:
                pass

        return sorted(list(districts))

    def get_cities(
        self,
        country: Optional[str] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> List[str]:
        """
        Return cities for a district, or for an entire state if district is omitted.
        Optionally qualified by country and merged with active database wells.
        """
        target_country = normalize_location_name(country) or "India"
        target_state = normalize_location_name(state)
        target_district = normalize_location_name(district)
        cities = set()

        if not target_district and not target_state:
            return []

        # Find in reference dataset
        for c_key, c_val in self.ref_data.items():
            if target_country and not _matches(c_key, target_country):
                continue
            for s_key, s_val in c_val.items():
                if target_state and not _matches(s_key, target_state):
                    continue
                for d_key, d_cities in s_val.items():
                    if target_district:
                        if _matches(d_key, target_district):
                            cities.update(d_cities)
                            break
                    else:
                        # District omitted: collect all cities across all districts in this state
                        cities.update(d_cities)

        # Merge with database wells
        if db:
            from app.models.database import Well
            try:
                query = db.query(Well.city).filter(
                    Well.city.isnot(None),
                    Well.is_active == True,
                )
                if target_district:
                    query = query.filter(func.lower(func.trim(Well.district)) == target_district.lower())
                if target_state:
                    state_variants = get_state_variants(target_state)
                    query = query.filter(func.lower(func.trim(Well.state)).in_(state_variants))
                if target_country:
                    country_variants = get_country_variants(target_country)
                    query = query.filter(func.lower(func.trim(Well.country)).in_(country_variants))

                for (ci,) in query.distinct().all():
                    norm = normalize_location_name(ci)
                    if norm:
                        cities.add(norm)
            except Exception:
                pass

        return sorted(list(cities))

    def get_hierarchy_tree(
        self,
        country: Optional[str] = None,
        state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Return hierarchical nested tree for requested country/state.
        Useful for building cascading select controls.
        """
        target_country = normalize_location_name(country) or "India"
        target_state = normalize_location_name(state)

        for c_key, c_val in self.ref_data.items():
            if _matches(c_key, target_country):
                if target_state:
                    for s_key, s_val in c_val.items():
                        if _matches(s_key, target_state):
                            return {
                                "country": c_key,
                                "state": s_key,
                                "districts": s_val,
                            }
                    return {"country": c_key, "state": target_state, "districts": {}}
                return {
                    "country": c_key,
                    "states": {s_name: list(d_map.keys()) for s_name, d_map in c_val.items()},
                }

        return {"country": target_country, "states": {}}

    def resolve_hierarchy_by_coordinates(self, lat: float, lon: float) -> Dict[str, Optional[str]]:
        """
        Resolve Country -> State -> District -> City from coordinates.
        Uses verified local bounding boxes first to respect Nominatim usage policy.
        """
        # 1. Check local bounding boxes
        for item in LOCAL_GEO_BOUNDS:
            if item["min_lat"] <= lat <= item["max_lat"] and item["min_lon"] <= lon <= item["max_lon"]:
                return {
                    "country": item["country"],
                    "state": item["state"],
                    "district": item["district"],
                    "city": item["city"],
                }

        # 2. Regional bounding box approximations for India
        if 8.0 <= lat <= 37.0 and 68.0 <= lon <= 97.5:
            # Uttar Pradesh region
            if 23.80 <= lat <= 30.50 and 77.00 <= lon <= 84.70:
                return {
                    "country": "India",
                    "state": "Uttar Pradesh",
                    "district": None,
                    "city": None,
                }
            # Jharkhand region
            if 21.90 <= lat <= 25.35 and 83.30 <= lon <= 87.95:
                return {
                    "country": "India",
                    "state": "Jharkhand",
                    "district": None,
                    "city": None,
                }
            # West Bengal region
            if 21.50 <= lat <= 27.30 and 85.80 <= lon <= 89.90:
                return {
                    "country": "India",
                    "state": "West Bengal",
                    "district": None,
                    "city": None,
                }
            # Bihar region
            if 24.20 <= lat <= 27.55 and 83.30 <= lon <= 88.30:
                return {
                    "country": "India",
                    "state": "Bihar",
                    "district": None,
                    "city": None,
                }
            # Delhi region
            if 28.40 <= lat <= 28.90 and 76.80 <= lon <= 77.40:
                return {
                    "country": "India",
                    "state": "Delhi",
                    "district": "New Delhi",
                    "city": "New Delhi",
                }
            # Maharashtra region
            if 15.60 <= lat <= 22.10 and 72.60 <= lon <= 80.90:
                return {
                    "country": "India",
                    "state": "Maharashtra",
                    "district": None,
                    "city": None,
                }

            return {
                "country": "India",
                "state": None,
                "district": None,
                "city": None,
            }

        return {
            "country": None,
            "state": None,
            "district": None,
            "city": None,
        }
