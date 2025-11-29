
import React from 'react';
import { Database } from 'lucide-react';

export const QlikTalendLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="#009845" />
    <path d="M64 28c-19.9 0-36 16.1-36 36s16.1 36 36 36 36-16.1 36-36-16.1-36-36-36zm0 60c-13.2 0-24-10.8-24-24s10.8-24 24-24 24 10.8 24-24 24z" fill="white"/>
    <rect x="70" y="70" width="20" height="8" transform="rotate(45 80 74)" fill="white"/>
  </svg>
);

export const InformaticaLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="#FF4D00" />
    <path d="M64 24c-22 0-40 18-40 40 0 22 18 40 40 40s40-18 40-40c0-22-18-40-40-40zm0 12c15.5 0 28 12.5 28 28S79.5 92 64 92 36 79.5 36 64s12.5-28 28-28z" fill="white" opacity="0.2"/>
    <path d="M86 64c0 12.1-9.9 22-22 22s-22-9.9-22-22 9.9-22 22-22 22 9.9 22 22z" fill="white"/>
    <path d="M64 36c-4 0-8 2-10 6 2-4 6-6 10-6zm20 10c4 2 6 6 6 10 0-4-2-8-6-10zM44 64c0-4 2-8 6-10-4 2-6 6-6 10zm20 28c4 0 8-2 10-6-2 4-6 6-10 6z" fill="white" opacity="0.6"/>
  </svg>
);

export const DataStageLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#000000"/>
    <path d="M28 40h72v12H28zM28 58h72v12H28zM28 76h72v12H28z" fill="#0530AD"/> 
    <text x="64" y="80" fontFamily="sans-serif" fontSize="60" fontWeight="bold" fill="white" textAnchor="middle" dy=".3em">IBM</text>
  </svg>
);

export const SSISLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#F2F2F2"/>
    <path d="M64 24c-22 0-40 5.4-40 12v12c0 6.6 18 12 40 12s40-5.4 40-12V36c0-6.6-18-12-40-12zm0 32c-15.6 0-29.2-2.7-35-6.8v10.8c0 6.6 18 12 40 12s40-5.4 40-12V49.2c-5.8 4.1-19.4 6.8-35 6.8zm0 24c-15.6 0-29.2-2.7-35-6.8v10.8c0 6.6 18 12 40 12s40-5.4 40-12V73.2c-5.8 4.1-19.4 6.8-35 6.8z" fill="#CC2927"/>
    <path d="M90 90l-16-8v16l16-8z" fill="#CC2927"/>
  </svg>
);

export const MatillionLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
     <path d="M64 8l56 32v64l-56 32L8 104V40L64 8z" fill="#00D3A9"/>
     <path d="M40 88V48l24 24 24-24v40" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const AbInitioLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="#333"/>
    <text x="64" y="85" fontFamily="serif" fontSize="90" fontWeight="bold" fill="white" textAnchor="middle">A</text>
  </svg>
);

export const PentahoLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#005D8C"/>
    <path d="M64 28l-36 64h72l-36-64z" fill="none" stroke="white" strokeWidth="8"/>
    <circle cx="64" cy="74" r="12" fill="white"/>
  </svg>
);

export const AWSGlueLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#232F3E"/>
    <path d="M34 94h60M64 34v60M34 64h60" stroke="#FF9900" strokeWidth="12" strokeLinecap="round"/>
    <circle cx="64" cy="64" r="16" fill="#FF9900"/>
  </svg>
);

export const AzureDFLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 128 128" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#0078D4"/>
    <path d="M30 90V50l20-10v50l-20 0zM55 90V40l20-10v60l-20 0zM80 90V30l20-10v70l-20 0z" fill="white" fillOpacity="0.9"/>
  </svg>
);

export const TOOLS = [
  { id: 'Talend', name: 'Talend (Qlik)', icon: QlikTalendLogo, description: 'Open Studio, Data Fabric', color: 'text-[#009845]' },
  { id: 'Informatica', name: 'Informatica', icon: InformaticaLogo, description: 'PowerCenter, IDMC', color: 'text-[#FF4D00]' },
  { id: 'DataStage', name: 'IBM DataStage', icon: DataStageLogo, description: 'InfoSphere, Cloud Pak', color: 'text-[#0530AD]' },
  { id: 'SSIS', name: 'SSIS', icon: SSISLogo, description: 'SQL Server Integration', color: 'text-[#CC2927]' },
  { id: 'Matillion', name: 'Matillion', icon: MatillionLogo, description: 'Cloud ETL', color: 'text-[#00D3A9]' },
  { id: 'AbInitio', name: 'Ab Initio', icon: AbInitioLogo, description: 'High Volume Processing', color: 'text-gray-800' },
  { id: 'Pentaho', name: 'Pentaho', icon: PentahoLogo, description: 'Kettle, PDI', color: 'text-[#005D8C]' },
  { id: 'AWSGlue', name: 'AWS Glue', icon: AWSGlueLogo, description: 'Serverless ETL', color: 'text-[#232F3E]' },
  { id: 'AzureDF', name: 'Azure Data Factory', icon: AzureDFLogo, description: 'Hybrid Integration', color: 'text-[#0078D4]' },
];
