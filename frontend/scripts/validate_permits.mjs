// Validate travel permit URLs
const urls = [
  // Karnataka
  { name: 'Jungle Lodges Karnataka', url: 'https://www.junglelodges.com/' },
  { name: 'Karnataka Eco Tourism', url: 'https://www.karnatakaecotourism.com/' },
  { name: 'Karnataka Forest Dept', url: 'https://aranya.gov.in/' },
  // Kerala
  { name: 'Sabarimala Queue', url: 'https://sabarimalaq.kerala.gov.in/' },
  { name: 'Kerala Forest Dept', url: 'https://forest.kerala.gov.in/' },
  { name: 'Kerala Tourism', url: 'https://www.keralatourism.org/' },
  { name: 'Periyar Tiger Reserve', url: 'https://periyartigerreserve.org/' },
  // Tamil Nadu
  { name: 'TN Forests', url: 'https://forests.tn.gov.in/' },
  { name: 'Ooty Tourism', url: 'https://nilgiris.nic.in/' },
  { name: 'TN Tourism', url: 'https://www.tamilnadutourism.tn.gov.in/' },
  // Uttarakhand
  { name: 'Char Dham Registration', url: 'https://registrationandtouristcare.uk.gov.in/' },
  { name: 'Badrinath Kedarnath', url: 'https://badrinath-kedarnath.gov.in/' },
  { name: 'UK Tourism', url: 'https://uttarakhandtourism.gov.in/' },
  // Himachal
  { name: 'HP Tourism', url: 'https://himachaltourism.gov.in/' },
  { name: 'Rohtang Permit', url: 'https://rohtangpermits.hp.gov.in/' },
  { name: 'GHNP', url: 'https://greathimalayannationalpark.org/' },
  // J&K
  { name: 'Amarnath Shrine Board', url: 'https://shriamarnathjishrine.com/' },
  { name: 'JK Tourism', url: 'https://jktourism.jk.gov.in/' },
  // Ladakh
  { name: 'Ladakh ILP', url: 'https://laikipleypermit.in/' },
  { name: 'Ladakh Tourism', url: 'https://ladakh.gov.in/' },
  // Goa
  { name: 'Goa Tourism', url: 'https://goatourism.gov.in/' },
  // Maharashtra
  { name: 'Maharashtra Tourism', url: 'https://maharashtratourism.gov.in/' },
  { name: 'ASI Tickets', url: 'https://asi.payumoney.com/' },
  // Andhra Pradesh
  { name: 'TTD Online', url: 'https://ttdsevaonline.com/' },
  { name: 'AP Tourism', url: 'https://www.aptourism.gov.in/' },
  // Telangana
  { name: 'Telangana Tourism', url: 'https://www.telanganatourism.gov.in/' },
  // North East
  { name: 'ILP Arunachal', url: 'https://arunachalilp.com/' },
  { name: 'Sikkim Tourism', url: 'https://sikkimtourism.gov.in/' },
  // More safaris
  { name: 'Bandipur National Park', url: 'https://bandipur.karnataka.gov.in/' },
  { name: 'Kukke Subramanya', url: 'https://www.ثسSubramanyatemple.com/' },
  { name: 'TTD Tirupati', url: 'https://tirupatibalaji.ap.gov.in/' },
  { name: 'Dharmasthala', url: 'https://www.ثسdharmasthala.org/' },
  { name: 'Male Mahadeshwara', url: 'https://mmhills.karnataka.gov.in/' },
];

async function validate() {
  for (const entry of urls) {
    try {
      const resp = await fetch(entry.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
      console.log(`${resp.status} | ${entry.name} | ${entry.url}`);
    } catch (err) {
      console.log(`FAIL | ${entry.name} | ${entry.url} | ${err.message}`);
    }
  }
}
validate();
