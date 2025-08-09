import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number
    }
  }
}

declare module 'jspdf-autotable' {
  const autoTable: (doc: jsPDF, options: any) => jsPDF
  export default autoTable
} 