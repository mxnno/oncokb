package org.mskcc.cbio.oncokb.api.pub.v1;

import io.swagger.annotations.ApiParam;
import org.mskcc.cbio.oncokb.model.*;
import org.mskcc.cbio.oncokb.util.AlterationUtils;
import org.mskcc.cbio.oncokb.util.EvidenceUtils;
import org.mskcc.cbio.oncokb.util.GeneUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.*;


@javax.annotation.Generated(value = "class io.swagger.codegen.languages.SpringCodegen", date = "2016-10-19T19:28:21.941Z")

@Controller
public class GenesApiController implements GenesApi {

    public ResponseEntity<List<GeneEvidence>> genesEntrezGeneIdEvidencesGet(
        @ApiParam(value = "The entrez gene ID.", required = true) @PathVariable("entrezGeneId") Integer entrezGeneId
        , @ApiParam(value = "Separate by comma. Evidence type includes GENE_SUMMARY, GENE_BACKGROUND") @RequestParam(value = "evidenceTypes", required = false) String evidenceTypes
    ) {

        List<GeneEvidence> evidenceList = new ArrayList<>();
        if (entrezGeneId == null) {
            return new ResponseEntity<>(evidenceList, HttpStatus.BAD_REQUEST);
        }

        Gene gene = GeneUtils.getGeneByEntrezId(entrezGeneId);

        if (gene == null) {
            return new ResponseEntity<>(evidenceList, HttpStatus.BAD_REQUEST);
        }

        Set<EvidenceType> evidenceTypeSet = new HashSet<>();
        if (evidenceTypes != null) {
            for (String type : evidenceTypes.trim().split("\\s*,\\s*")) {
                EvidenceType et = EvidenceType.valueOf(type);
                evidenceTypeSet.add(et);
            }
        } else {
            evidenceTypeSet.add(EvidenceType.GENE_SUMMARY);
            evidenceTypeSet.add(EvidenceType.GENE_BACKGROUND);
        }

        Map<Gene, Set<Evidence>> map = EvidenceUtils.getEvidenceByGenesAndEvidenceTypes(Collections.singleton(gene), evidenceTypeSet);
        Set<Evidence> evidences = map.get(gene);

        if (evidences == null) {
            evidences = new HashSet<Evidence>();
        }

        Set<GeneEvidence> geneEvidences = new HashSet<>();

        for (Evidence evidence : evidences) {
            geneEvidences.add(new GeneEvidence(evidence));
        }

        evidenceList.addAll(geneEvidences);
        return new ResponseEntity<>(evidenceList, HttpStatus.OK);
    }

    public ResponseEntity<Gene> genesEntrezGeneIdGet(
        @ApiParam(value = "The entrez gene ID.", required = true) @PathVariable("entrezGeneId") Integer entrezGeneId
    ) {
        Gene gene = null;
        if (entrezGeneId == null) {
            return new ResponseEntity<>(gene, HttpStatus.BAD_REQUEST);
        }

        gene = GeneUtils.getGeneByEntrezId(entrezGeneId);

        if (gene == null) {
            return new ResponseEntity<>(gene, HttpStatus.BAD_REQUEST);
        }

        return new ResponseEntity<>(gene, HttpStatus.OK);
    }

    public ResponseEntity<List<Alteration>> genesEntrezGeneIdVariantsGet(
        @ApiParam(value = "The entrez gene ID.", required = true) @PathVariable("entrezGeneId") Integer entrezGeneId
    ) {
        List<Alteration> alterationList = new ArrayList<>();
        if (entrezGeneId == null) {
            return new ResponseEntity<>(alterationList, HttpStatus.BAD_REQUEST);
        }

        Gene gene = GeneUtils.getGeneByEntrezId(entrezGeneId);

        if (gene == null) {
            return new ResponseEntity<>(alterationList, HttpStatus.BAD_REQUEST);
        }

        Set<Alteration> alterations = AlterationUtils.getAllAlterations(gene);

        if (alterations == null) {
            alterations = new HashSet<>();
        }
        alterationList.addAll(alterations);
        return new ResponseEntity<>(alterationList, HttpStatus.OK);
    }

    public ResponseEntity<List<Gene>> genesGet() {
        Set<Gene> genes = GeneUtils.getAllGenes();
        if (genes == null) {
            genes = new HashSet<>();
        }
        List<Gene> geneList = new ArrayList<>(genes);
        return new ResponseEntity<>(geneList, HttpStatus.OK);
    }

    public ResponseEntity genesLookupGet(@ApiParam(value = "The gene symbol used in Human Genome Organisation.") @RequestParam(value = "hugoSymbol", required = false) String hugoSymbol
        , @ApiParam(value = "The entrez gene ID.") @RequestParam(value = "entrezGeneId", required = false) Integer entrezGeneId
    ) {
        Set<Gene> genes = new HashSet<>();
        HttpStatus status = HttpStatus.OK;

        if (entrezGeneId != null && hugoSymbol != null && !GeneUtils.isSameGene(entrezGeneId, hugoSymbol)) {
            status = HttpStatus.BAD_REQUEST;
        } else {
            if (hugoSymbol != null) {
                Set<Gene> blurGenes = GeneUtils.searchGene(hugoSymbol);
                if (blurGenes != null) {
                    genes.addAll(blurGenes);
                }
            }

            if (entrezGeneId != null) {
                Gene gene = GeneUtils.getGeneByEntrezId(entrezGeneId);
                if (gene != null) {
                    if (!genes.contains(gene)) {
                        genes = new HashSet<>();
                    }
                }
            }
        }

        List<Gene> geneList = new ArrayList<>(genes);
        return new ResponseEntity<>(geneList, status);
    }

}
