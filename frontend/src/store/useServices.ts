import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { services as defaultServices } from '../data/services';
import type { Service } from '../data/services';
import defaultValidationRegistry from '../data/validation-registry.json';

export interface ValidationRegistryEntry {
  id: string;
  serviceName: string;
  currentUrl: string;
  statusCode: number;
  validationStatus: 'Valid' | 'Broken' | 'Needs Review';
  lastValidatedAt: string;
  oldUrl?: string;
  newUrl?: string;
  updatedAt?: string;
  sourceAuthority?: string;
  responseTime?: number;
}

interface ServicesState {
  services: Service[];
  validationRegistry: ValidationRegistryEntry[];
  addService: (service: Omit<Service, 'id'>) => void;
  updateService: (id: string, service: Partial<Service>) => void;
  deleteService: (id: string) => void;
  resetToDefaults: () => void;
  updateLinkValidation: (id: string, fields: Partial<ValidationRegistryEntry>) => void;
  setValidationRegistry: (registry: ValidationRegistryEntry[]) => void;
}

export const useServices = create<ServicesState>()(
  persist(
    (set) => ({
      services: defaultServices,
      validationRegistry: defaultValidationRegistry as ValidationRegistryEntry[],
      
      addService: (newService) => set((state) => {
        const customId = `custom-${Date.now()}`;
        return {
          services: [
            ...state.services, 
            { 
              ...newService, 
              id: customId,
              validated: false,
              statusCode: 0,
              lastValidatedDate: ''
            }
          ],
          validationRegistry: [
            ...state.validationRegistry,
            {
              id: customId,
              serviceName: newService.name,
              currentUrl: newService.url,
              statusCode: 0,
              validationStatus: 'Needs Review',
              lastValidatedAt: ''
            }
          ]
        };
      }),
      
      updateService: (id, updatedFields) => set((state) => {
        const urlChanged = updatedFields.url !== undefined;
        return {
          services: state.services.map((service) => 
            service.id === id 
              ? { 
                  ...service, 
                  ...updatedFields,
                  ...(urlChanged ? { validated: false, statusCode: 0, lastValidatedDate: '' } : {})
                } 
              : service
          ),
          validationRegistry: state.validationRegistry.map((entry) => {
            if (entry.id === id) {
              return {
                ...entry,
                serviceName: updatedFields.name || entry.serviceName,
                currentUrl: updatedFields.url || entry.currentUrl,
                ...(urlChanged ? { statusCode: 0, validationStatus: 'Needs Review', lastValidatedAt: '', responseTime: undefined, sourceAuthority: undefined } : {})
              };
            }
            return entry;
          })
        };
      }),
      
      deleteService: (id) => set((state) => ({
        services: state.services.filter((service) => service.id !== id),
        validationRegistry: state.validationRegistry.filter((entry) => entry.id !== id)
      })),
      
      resetToDefaults: () => set({ 
        services: defaultServices,
        validationRegistry: defaultValidationRegistry as ValidationRegistryEntry[]
      }),

      updateLinkValidation: (id, fields) => set((state) => {
        let updatedServices = state.services;
        const targetUrl = fields.newUrl || fields.currentUrl;
        
        if (targetUrl) {
          updatedServices = state.services.map(s => {
            if (s.id === id) {
              return {
                ...s,
                url: targetUrl,
                validated: fields.validationStatus === 'Valid',
                statusCode: fields.statusCode ?? s.statusCode,
                lastValidatedDate: fields.lastValidatedAt ? fields.lastValidatedAt.split('T')[0] : s.lastValidatedDate
              };
            }
            return s;
          });
        }

        const updatedRegistry = state.validationRegistry.map((entry) => 
          entry.id === id ? { ...entry, ...fields } : entry
        );

        return {
          services: updatedServices,
          validationRegistry: updatedRegistry
        };
      }),

      setValidationRegistry: (registry) => set({ validationRegistry: registry })
    }),
    {
      name: 'gravity-services-storage',
      version: 10, // Incremented version to support validation fields
    }
  )
);
