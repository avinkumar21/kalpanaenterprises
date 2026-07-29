import masterRegistry from './master-registry.json';

export interface Service {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  tag: string;
  url: string;
  image?: string;
  departmentId?: string;
  permitCategoryId?: string;               // 3rd-level grouping for permit services
  // ── Quality Gate Fields (Step 7) ──
  validated: boolean;                                        // Step 9: true = render, false = suppress
  statusCode: number;                                        // Step 2: HTTP status (200/301/302)
  lastValidatedDate: string;                                 // Step 8: ISO date
  popularityScore: 'Very High' | 'High' | 'Medium' | 'Low'; // Step 6: citizen usage rank
}

function mapRegistryToServices(registry: any[]): Service[] {
  return registry.map(record => {
    let categoryId = '';
    const type = record.type;
    if (type === 'Central Government') categoryId = 'central';
    else if (type === 'State Government') categoryId = 'state';
    else if (type === 'Temple') categoryId = 'temple';
    else if (type === 'Travel Permit') categoryId = 'permits';
    else if (type === 'Travel & Transport') categoryId = 'travel';
    else if (type === 'Booking') categoryId = 'bookings';
    else if (type === 'CA & Financial Services') categoryId = 'ca';
    else if (type === 'Health') categoryId = 'health';
    else if (type === 'Education') categoryId = 'education';
    else categoryId = type.toLowerCase();

    // Map department/state back to departmentId
    let departmentId = '';
    if (categoryId === 'state' || categoryId === 'central') {
      departmentId = record.department || '';
    } else if (categoryId === 'permits') {
      departmentId = record.state || '';
    }

    return {
      id: record.id,
      categoryId: categoryId,
      categoryName: record.category,
      name: record.name,
      description: record.description,
      tag: record.keywords?.[0] || '',
      url: record.officialUrl,
      image: record.image || undefined,
      departmentId: departmentId || undefined,
      permitCategoryId: record.subcategory || undefined,
      validated: record.validated,
      statusCode: record.statusCode,
      lastValidatedDate: record.lastValidated,
      popularityScore: (record.popularityScore as any) || 'Medium'
    };
  });
}

export const services: Service[] = mapRegistryToServices(masterRegistry);