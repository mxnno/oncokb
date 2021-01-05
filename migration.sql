

# Update to v1.24
# Applicable to v1.24~v2.7
create table geneset
(
    id   int auto_increment
        primary key,
    name varchar(255) not null,
    uuid varchar(40)  not null
);


create table geneset_gene
(
    geneset_id     int not null,
    entrez_gene_id int not null,
    primary key (geneset_id, entrez_gene_id),
    constraint FKA19C3AE7C602BC92
        foreign key (entrez_gene_id) references gene (entrez_gene_id),
    constraint FKA19C3AE7C94E945F
        foreign key (geneset_id) references geneset (id)
);

rename table portalAlt_oncoKBAlt to portal_alteration_oncokb_alteration;
alter table portal_alteration_oncokb_alteration
    change alteration_id oncokb_alteration_id int not null;
alter table portal_alteration_oncokb_alteration
    change portalAlteration_id portal_alteration_id int not null;

alter table evidence
    change propagation solid_propagation_level varchar(10) null;
alter table evidence
    add for_germline bit null;
alter table evidence
    add liquid_propagation_level varchar(255) null;
alter table evidence
    add last_review datetime null;

alter table gene
    change curatedIsoform curated_isoform varchar(100) null;
alter table gene
    change curatedRefSeq curated_ref_seq varchar(100) null;
alter table gene
    change TSG tsg bit null;





