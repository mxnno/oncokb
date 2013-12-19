package org.mskcc.cbio.oncogkb.model;
// Generated Dec 19, 2013 1:33:26 AM by Hibernate Tools 3.2.1.GA



/**
 * AlterationActivityEvidence generated by hbm2java
 */
public class AlterationActivityEvidence  implements java.io.Serializable {


     private Integer alterationActivityEvidenceId;
     private TumorType tumorType;
     private Alteration alteration;
     private String knownEffect;
     private String descriptionOfKnownEffect;
     private String genomicContext;
     private String pmids;

    public AlterationActivityEvidence() {
    }

	
    public AlterationActivityEvidence(Alteration alteration, String knownEffect) {
        this.alteration = alteration;
        this.knownEffect = knownEffect;
    }
    public AlterationActivityEvidence(TumorType tumorType, Alteration alteration, String knownEffect, String descriptionOfKnownEffect, String genomicContext, String pmids) {
       this.tumorType = tumorType;
       this.alteration = alteration;
       this.knownEffect = knownEffect;
       this.descriptionOfKnownEffect = descriptionOfKnownEffect;
       this.genomicContext = genomicContext;
       this.pmids = pmids;
    }
   
    public Integer getAlterationActivityEvidenceId() {
        return this.alterationActivityEvidenceId;
    }
    
    public void setAlterationActivityEvidenceId(Integer alterationActivityEvidenceId) {
        this.alterationActivityEvidenceId = alterationActivityEvidenceId;
    }
    public TumorType getTumorType() {
        return this.tumorType;
    }
    
    public void setTumorType(TumorType tumorType) {
        this.tumorType = tumorType;
    }
    public Alteration getAlteration() {
        return this.alteration;
    }
    
    public void setAlteration(Alteration alteration) {
        this.alteration = alteration;
    }
    public String getKnownEffect() {
        return this.knownEffect;
    }
    
    public void setKnownEffect(String knownEffect) {
        this.knownEffect = knownEffect;
    }
    public String getDescriptionOfKnownEffect() {
        return this.descriptionOfKnownEffect;
    }
    
    public void setDescriptionOfKnownEffect(String descriptionOfKnownEffect) {
        this.descriptionOfKnownEffect = descriptionOfKnownEffect;
    }
    public String getGenomicContext() {
        return this.genomicContext;
    }
    
    public void setGenomicContext(String genomicContext) {
        this.genomicContext = genomicContext;
    }
    public String getPmids() {
        return this.pmids;
    }
    
    public void setPmids(String pmids) {
        this.pmids = pmids;
    }




}

