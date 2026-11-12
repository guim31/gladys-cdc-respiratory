# CDC Respiratory Viruses

Le COVID-19, la grippe et le VRS dans votre État ou comté américain, d'après les données ouvertes du **CDC** (Centers
for Disease Control and Prevention) : le **niveau d'activité virale dans les eaux usées** du National Wastewater
Surveillance System (NWSS) et les **hospitalisations** du National Healthcare Safety Network (NHSN). Un appareil par
lieu, des déclencheurs de scène, une action de scène et un widget.

> **Information de santé publique, pas un avis médical.** Ce sont des niveaux pour tout un État ou quelques stations
> d'épuration. Pour votre santé, demandez à votre médecin.

Non affiliée au CDC.

## Ce que vous obtenez

- **Un appareil par lieu** choisi : un État (les 50 États, le district de Columbia et Porto Rico), ou un comté que
  vous saisissez.
- Pour le COVID-19, la grippe et le VRS : le **niveau dans les eaux usées** (1 Très bas à 5 Très élevé) et sa
  **tendance**, les **hospitalisations pour 100 000 habitants** de la semaine et leur **niveau** (1 à 5).
- La **semaine des données** (« Semaine au 31 oct. »).
- Deux **déclencheurs de scène** (un niveau monte jusqu'à un niveau choisi, ou repasse dessous), une **action de
  scène** (la semaine en une phrase) et un **widget**.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys. Ni compte ni clé.
- États-Unis seulement.

## Configuration

### Réglages

| Réglage                            | Défaut   | Rôle                                                                               |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| États                              | aucun    | Les États à suivre, un appareil chacun.                                            |
| Comtés                             | vide     | `Comté, ST` séparés par des points-virgules, 10 au plus : `Harris, TX; Cook, IL`   |
| Jeton d'application (facultatif)   | vide     | Un jeton gratuit de data.cdc.gov, seulement si la limite de requêtes est atteinte. |
| Langue des noms de fonctionnalités | Français | Noms des nouvelles fonctionnalités, langue de leurs textes et du résumé.           |

Enregistrez, puis ouvrez l'onglet **Découverte** de l'intégration et créez les appareils voulus.

Un comté est retrouvé par son nom parmi les comtés que dessert chaque station d'épuration (« Harris County » et
« Harris » sont équivalents). Un comté **sans station à lui** affiche les niveaux de tout son État, et sa semaine
l'indique (« eaux usées de l'État »). Ses chiffres hospitaliers sont toujours ceux de son État : le NHSN ne publie rien
par comté.

## Appareils

| Fonctionnalité (× COVID-19, grippe, VRS) | Type   | Valeur                                                                |
| ---------------------------------------- | ------ | --------------------------------------------------------------------- |
| Eaux usées …, niveau                     | nombre | 1 Très bas, 2 Bas, 3 Modéré, 4 Élevé, 5 Très élevé                    |
| Eaux usées …, tendance                   | texte  | en hausse, stable ou en baisse                                        |
| Hôpital …, niveau                        | nombre | 1 à 5, le niveau NHSN des hospitalisations de l'État                  |
| Hospitalisations … /100 000              | nombre | nouvelles hospitalisations pour 100 000 habitants dans la semaine     |
| Semaine des données                      | texte  | date de fin de la semaine (samedi), de chaque source si elles varient |

Le **niveau eaux usées d'un État ou d'un comté** est la médiane des niveaux de ses stations ayant publié cette
semaine-là, comme sur la carte du CDC ; l'intégration le calcule à partir des niveaux par station publiés par le CDC,
il peut donc rarement différer d'un cran de la carte. Pour la grippe, les eaux usées mesurent la **grippe A** ; les
hôpitaux comptent toutes les grippes.

Une semaine compte dès qu'au moins la moitié des stations de la semaine précédente l'ont publiée : d'ici là,
l'appareil garde la semaine précédente.

La **tendance** compare la valeur médiane des eaux usées à la semaine précédente : « en hausse » dès +20 % (et au
moins +0,5), « en baisse » dès −1/6 (et au moins −0,5), sinon « stable ».

Les niveaux sont des nombres : une condition de scène comme « Eaux usées VRS, niveau ≥ 4 » fonctionne directement.

## Widget

**Virus respiratoires** : le lieu choisi (sinon le premier suivi), avec une ligne par virus pour les eaux usées
(niveau et tendance) et une pour les hôpitaux (hospitalisations et niveau), en vert jusqu'à Bas, en orange à Modéré,
en rouge dès Élevé, et une légende avec la semaine et la source. Un réglage choisit les indicateurs affichés, un autre
masque la légende.

## Déclencheurs de scène

- **Le niveau d'un virus respiratoire monte** : à la publication d'une nouvelle semaine, un niveau eaux usées ou
  hôpital d'un lieu atteint le niveau choisi (Bas à Très élevé) en montant. Filtres : lieu, virus, indicateur, niveau.
- **Le niveau d'un virus respiratoire baisse** : la même chose à la baisse : le niveau repasse sous celui choisi.

Variables : lieu, virus, indicateur, niveau (nombre), nom du niveau, niveau précédent, semaine. La première semaine lue
après l'installation sert seulement de référence : elle ne déclenche rien.

## Action de scène

**CDC : obtenir la semaine en une phrase** : renvoie, pour un lieu (vide : le premier suivi), une phrase prête pour une
notification, comme « Texas, semaine au 31 oct. : COVID-19 : niveau bas et en baisse dans les eaux usées, 1,15
hospitalisations pour 100 000 hab. ; Grippe : … », dans la langue de la configuration, avec chaque niveau et chaque
taux en sortie séparée.

## Exemples de scènes

- Chaque samedi à 9 h, envoyer la phrase de votre comté au groupe familial.
- Quand le niveau eaux usées de la grippe de votre comté atteint Élevé, rappeler à tous de se laver les mains, ou
  prévoir le vaccin.
- Quand le niveau du VRS repasse sous Modéré, annoncer la fin de la vague.

## Sources de données, licence et quotas

- Source : **CDC**, [data.cdc.gov](https://data.cdc.gov), domaine public (œuvre du gouvernement américain), lu sans
  compte :
  - `atcp-73re`, « CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV » (NWSS), mis à jour le
    vendredi ;
  - `vdzy-6i9v`, « Weekly Hospital Respiratory Admission Levels and Rates by Jurisdiction » (NHSN), hebdomadaire.
- Les données sont **hebdomadaires** ; l'intégration les lit **toutes les 6 heures** (deux requêtes, pour les seuls
  États suivis et les quatre dernières semaines) : une nouvelle semaine apparaît moins de 6 heures après sa
  publication.
- Sans jeton, data.cdc.gov limite les requêtes de chaque adresse ; un foyer en reste très loin. Après une réponse
  « trop de requêtes », l'intégration attend une heure (puis davantage), redémarrages compris. Un jeton d'application
  (gratuit, sur data.cdc.gov) relève la limite.

## Dépannage

- **Aucune valeur après la création de l'appareil** : attendez quelques secondes la première lecture ; vérifiez que
  Gladys a accès à Internet.
- **Aucune valeur eaux usées** : aucune station de l'État n'a publié depuis quatre semaines (le Dakota du Nord et
  l'Oklahoma, par exemple, en novembre 2026). Les valeurs hospitalières arrivent quand même.
- L'état de connexion indique que data.cdc.gov est illisible : le portail est injoignable ; les dernières valeurs
  restent et l'intégration réessaie 30 minutes plus tard, puis toutes les 6 heures.
- L'état de connexion indique que data.cdc.gov limite les requêtes : l'intégration attend et réessaie seule ; ajoutez
  un jeton d'application si cela se répète.

## Limites

- Développée et testée contre le vrai data.cdc.gov, pas encore dans un Gladys en service : vos retours sont bienvenus.
- Les niveaux eaux usées des États et des comtés sont calculés par l'intégration à partir des niveaux par station
  (médiane), pas lus sur la carte du CDC.
- Les données hospitalières n'existent que par État ; un comté reçoit celles de son État.
- Hors saison, un niveau peut rester non publié (« Data Unavailable ») : l'appareil garde sa dernière valeur.
