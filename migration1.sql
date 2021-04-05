create table alteration_reference_genome
(
    alteration_id    int         not null,
    reference_genome varchar(10) null,
    constraint FKE8AFDC0BAAD5975
        foreign key (alteration_id) references alteration (id)
);

INSERT INTO alteration_reference_genome (alteration_id)
SELECT id
FROM alteration;
update alteration_reference_genome
set reference_genome='GRCh37'
where reference_genome is null;

alter table gene
    change curated_isoform grch37_isoform varchar(100) null;

alter table gene
    change curated_ref_seq grch37_ref_seq varchar(100) null;

alter table gene
    add grch38_isoform varchar(100) null;

alter table gene
    add grch38_ref_seq varchar(100) null;
