export const messages = {
  fr: {
    common: {
      appName: "ALMAC School Management",
      loading: "Chargement...",
      save: "Enregistrer",
      saving: "Enregistrement...",
      refresh: "Actualiser",
      refreshing: "Actualisation...",
      cancel: "Annuler",
      edit: "Modifier",
      delete: "Supprimer",
      print: "Imprimer",
      back: "Retour",
      search: "Rechercher",
      status: "Statut",
      actions: "Actions",
      yes: "Oui",
      no: "Non",
      active: "Actif",
      inactive: "Inactif",
      required: "Obligatoire",
      optional: "Optionnel",
      select: "Sélectionner",
      noRecords: "Aucun enregistrement trouvé.",
      createdSuccessfully: "Créé avec succès.",
      savedSuccessfully: "Enregistré avec succès.",
      openWorkspace: "Ouvrir l'espace",
      ready: "Prêt",
    },

    auth: {
      forgotPassword: {
        title: "Mot de passe oublié",
        description: "Entrez votre adresse électronique. Si un compte admissible existe, vous recevrez les instructions de réinitialisation.",
        email: "Adresse électronique",
        submit: "Envoyer les instructions",
        submitting: "Envoi...",
        successTitle: "Vérifiez votre messagerie",
        successMessage: "Si un compte admissible existe pour cette adresse, un courriel de réinitialisation sera envoyé.",
        backToLogin: "Retour à la connexion",
        requestFailed: "Impossible de traiter la demande.",
      },
      resetPassword: {
        title: "Créer un nouveau mot de passe",
        checking: "Vérification du lien...",
        invalidTitle: "Lien indisponible",
        invalidMessage: "Ce lien de réinitialisation est invalide ou a expiré.",
        account: "Compte",
        password: "Nouveau mot de passe",
        confirmPassword: "Confirmer le mot de passe",
        passwordHint: "Utilisez au moins 15 caractères. Les espaces sont autorisés.",
        submit: "Réinitialiser le mot de passe",
        submitting: "Réinitialisation...",
        mismatch: "Les mots de passe ne correspondent pas.",
      },
    },
    nav: {
      dashboard: "Tableau de bord",
      demo: "Démo finale",
      academicStructure: "Structure académique",
      academics: "Académie",
      admissions: "Admissions",
      students: "Élèves",
      users: "Utilisateurs",
      attendance: "Présences",
      gradebooks: "Cahier de notes",
      finance: "Finances",
      payroll: "Paie",
      reports: "Rapports",
      settings: "Paramètres",
      schools: "Écoles",
      staff: "Personnel",
      onboarding: "Intégration",
      activity: "Activité",
    },

    workspace: {
      currentRoleContext: "Contexte du rôle actuel",
      noActiveRole: "Aucun rôle actif",
      quickActions: "Actions rapides",
      quickActionsDescription: "Raccourcis utiles pour cet espace.",
      operationalAttention: "Points d'attention",
      operationalAttentionDescription: "Éléments à vérifier avant de continuer.",
    },

    dashboard: {
      title: "Tableau de bord",
      description:
        "Vue d'ensemble des opérations scolaires, admissions, présences, finances et résultats.",
      schoolOverview: "Vue d'ensemble de l'école",
      operationalSummary: "Résumé opérationnel du jour.",
      activeStudents: "Élèves actifs",
      registeredStudents: "élèves inscrits",
      pendingAdmissions: "Admissions en attente",
      admittedApplications: "admis/confirmés",
      attendanceToday: "Présences aujourd'hui",
      present: "présents",
      absent: "absents",
      unpaidInvoices: "Factures impayées",
      due: "à payer",
      paymentsToday: "Paiements aujourd'hui",
      thisMonth: "ce mois-ci",
      assessments: "Évaluations",
      gradebookRecords: "Éléments du cahier de notes",
      payrollPending: "Paie en attente",
      salaryItemsPending: "salaires en attente de paiement",
      setup: "Configuration",
      structureSectionsSubjects: "Structure, sections et matières",
      schoolDashboard: "Tableau de bord de l'école",
      liveOperationalSummary: "Résumé opérationnel en direct pour l'école active.",
      demoFlows: "Flux principaux de démonstration",
      demoFlowsDescription:
        "Chaque flux majeur est accessible en un clic depuis ce tableau de bord.",
      studentFiles: "Dossiers élèves",
      financeReceipts: "Finances et reçus",
      gradebooksReports: "Cahier de notes et rapports",
      payrollPayslips: "Paie et fiches de paie",
    },

    academic: {
      title: "Structure académique",
      description:
        "Configurez les divisions, classes, sections, matières et coefficients de l'école.",
      workspaceTitle: "Espace académique",
      workspaceDescription:
        "Revoyez et gérez la structure académique et l'organisation pédagogique de l'école.",
      operationsTitle: "Opérations académiques",
      operationsSubtitle:
        "Choisissez les divisions offertes par cette école, puis ajoutez des sections supplémentaires au besoin.",
      academicOperations: "Opérations académiques",
      academicOperationsDescription:
        "Choisissez les divisions offertes par cette école, puis ajoutez des sections supplémentaires au besoin.",
      quickActionStructureTitle: "Structure académique",
      quickActionStructureDescription:
        "Choisir les divisions offertes et revoir les classes et sections.",
      quickActionAttendanceTitle: "Présences",
      quickActionAttendanceDescription:
        "Passer de la structure des classes aux opérations quotidiennes de présence.",
      quickActionGradebookTitle: "Cahier de notes",
      quickActionGradebookDescription:
        "Revoir les évaluations et les notes selon le contexte académique.",
      quickActionSettingsTitle: "Paramètres",
      quickActionSettingsDescription:
        "Revoir la configuration académique et la préparation structurelle.",
      attentionStructureTitle:
        "La structure académique pilote tout le workflow scolaire",
      attentionStructureDescription:
        "Chaque école peut choisir sa propre structure : maternelle seulement, primaire seulement, secondaire seulement, ou une combinaison.",
      attentionTeacherSubjectTitle:
        "Vérifier les assignations enseignants-matières",
      attentionTeacherSubjectDescription:
        "Un enseignant ne devrait voir que les classes et matières qui correspondent à son assignation réelle.",
      attentionTeacherPriorityTitle: "Priorité enseignant",
      attentionTeacherPriorityDescription:
        "Utilisez cet espace pour confirmer votre contexte académique avant de prendre les présences ou gérer le cahier de notes.",
      attentionAdminPriorityTitle: "Priorité administrative",
      attentionAdminPriorityDescription:
        "Valider la structure avant de publier les notes, générer les bulletins ou commencer un nouveau trimestre.",
      quickSetupTitle: "Configuration rapide de la structure scolaire",
      quickSetupDescription:
        "Sélectionnez les classes offertes par l'école et indiquez le nombre de salles/sections pour chaque classe.",
      saveStructure: "Enregistrer la structure",
      selectAtLeastOneClass: "Sélectionnez au moins une classe.",
      structureSaved:
        "Structure enregistrée : {gradeCount} classes et {sectionCount} sections.",
      kindergarten: "Maternelle",
      primary: "Primaire / Fondamental",
      secondary: "Secondaire",
      other: "Autres",
      enableAll: "Activer tout",
      sections: "Sections",
      noSectionYet: "Aucune section pour le moment.",
      quickSetupNotice:
        "Cette configuration crée ou met à jour les classes et sections. Elle ne supprime pas les élèves, factures, présences ou notes existants.",
      classesAndSections: "Classes et sections",
      classesAndSectionsDescription:
        "Ajustez facilement le nombre de sections/salles pour chaque classe.",
      numberOfSections: "Nombre de sections",
      code: "Code",
      classCount: "{count} classe(s)",
      sectionsUpdated: "Sections mises à jour.",
      blockedArchive:
        "Enregistré, mais {count} section(s) n'ont pas pu être archivées car elles ont encore des élèves actifs.",
      gradeLevels: "Classes / niveaux",
      sectionSubjects: "Matières par section",
      teachingAssignments: "Assignations d'enseignement",
      noTeachingAssignments: "Aucune assignation d'enseignement trouvée.",
      noActiveAcademicYear:
        "Aucune année académique active trouvée. Complétez d'abord la configuration de l'école.",
      teacher: "Enseignant",
      order: "Ordre",
      subjectSetup: "Configuration des matières",
      subjectSetupDescription:
        "Créez les matières de l'école et assignez-les à chaque classe avec un coefficient.",
      createSubject: "Créer une matière",
      subjectCodePlaceholder: "Code, exemple : MATH",
      frenchName: "Nom français",
      englishNameOptional: "Nom anglais optionnel",
      descriptionOptional: "Description optionnelle",
      saveSubject: "Enregistrer la matière",
      assignSubject: "Assigner une matière",
      assigning: "Assignation...",
      assignSubjectToClass: "Assigner une matière à une classe",
      selectGradeLevel: "Sélectionner une classe",
      selectSubject: "Sélectionner une matière",
      coefficient: "Coefficient",
      displayOrder: "Ordre d'affichage",
      requiredSubject: "Matière obligatoire",
      subjectSaved: "Matière enregistrée avec succès.",
      subjectAssigned: "Matière assignée avec succès.",
      noSubjectsYet: "Aucune matière créée pour le moment.",
      noAssignedSubjects:
        "Aucune matière assignée à cette classe pour le moment.",
      advancedManualConfiguration: "Configuration manuelle avancée",
      advancedManualDescription:
        "Utilisez ces contrôles pour ajuster manuellement les classes, sections ou capacités générées.",
      configureAcademicDivisions: "Configurer les divisions académiques",
      selectOfferedLevels: "Sélectionnez seulement les niveaux offerts par cette école.",
      createSelectedStructure: "Créer la structure sélectionnée",
      creating: "Création...",
      manualGradeLevelsAndSections: "Classes et sections manuelles",
      configureRoomsSections: "Configurer salles / sections",
      noSectionsConfigured: "Aucune section configurée pour le moment.",
    },

    users: {
      management: {
        title: "Utilisateurs et accès", description: "Invitez les membres du personnel et gérez leurs accès à l’école.", inviteUser: "Inviter un utilisateur", inviteDescription: "L’utilisateur recevra un courriel sécurisé pour activer son compte.", email: "Adresse électronique", firstName: "Prénom", lastName: "Nom", role: "Rôle", language: "Langue du courriel", sendInvitation: "Envoyer l’invitation", sendingInvitation: "Envoi de l’invitation...", usersTab: "Utilisateurs", invitationsTab: "Invitations", verified: "Adresse vérifiée", notVerified: "Adresse non vérifiée", lastLogin: "Dernière connexion", neverConnected: "Jamais connecté", membershipActive: "Accès actif", membershipSuspended: "Accès suspendu", suspend: "Suspendre", reactivate: "Réactiver", resend: "Renvoyer", revoke: "Révoquer", pending: "En attente", accepted: "Acceptée", expired: "Expirée", revoked: "Révoquée", emailDeliveryFailed: "Échec de l’envoi du courriel", invitationSent: "L’invitation a été créée et envoyée.", invitationCreatedButEmailFailed: "L’invitation a été créée, mais le courriel n’a pas pu être envoyé.", noUsers: "Aucun utilisateur trouvé.", noInvitations: "Aucune invitation trouvée.", confirmSuspend: "Suspendre l’accès de cet utilisateur à l’école ?", confirmRevoke: "Révoquer cette invitation ?",
        staffCode: "Code du personnel",
        jobTitle: "Titre du poste",
        department: "Département",
        guardian: "Dossier du parent / responsable",
        selectGuardian: "Sélectionner un responsable",
        alreadyLinked: "Compte déjà lié",
        financePermissions: "Autorisations financières initiales",
        payrollNotDefault: "L’accès à la paie n’est pas accordé par défaut.",
        permissions: {
          FINANCE_DASHBOARD_VIEW: "Voir le tableau de bord financier",
          FINANCE_INVOICES_VIEW: "Voir les factures",
          FINANCE_INVOICES_CREATE: "Créer des factures",
          FINANCE_INVOICES_EDIT: "Modifier les factures",
          FINANCE_INVOICES_VOID: "Annuler des factures",
          FINANCE_BILLING_MANAGE: "Gérer les plans et lots de facturation",
          FINANCE_PAYMENTS_VIEW: "Voir les paiements",
          FINANCE_PAYMENTS_RECORD: "Enregistrer des paiements",
          FINANCE_PAYMENTS_REVERSE: "Contrepasser des paiements",
          FINANCE_RECEIPTS_PRINT: "Imprimer les reçus",
          FINANCE_REPORTS_VIEW: "Voir les rapports financiers",
          FINANCE_REPORTS_EXPORT: "Exporter les rapports financiers",
          FINANCE_SETTINGS_MANAGE: "Gérer les paramètres financiers",
          FINANCE_CASHIER_SESSIONS_SUPERVISE: "Superviser et rouvrir les sessions de caisse",
          FINANCE_CREDIT_NOTES_CREATE: "Créer des notes de crédit",
          FINANCE_CORRECTIONS_APPROVE: "Approuver les corrections financières",
          FINANCE_RECONCILIATION_MANAGE: "Gérer les rapprochements de dépôts",
          FINANCE_PERIOD_CLOSE: "Clôturer et rouvrir les périodes financières",
          PAYROLL_VIEW: "Voir la paie",
          PAYROLL_MANAGE: "Gérer la paie",
        },        roles: { SCHOOL_ADMIN: "Administrateur de l’école", TEACHER: "Enseignant", FINANCE_ADMIN: "Responsable financier", PARENT: "Parent / Responsable" },
      },
    },
    students: {
      title: "Élèves",
      description:
        "Gérez les dossiers élèves, responsables, classes, statut, finances et présences.",
      studentFile: "Dossier élève",
      firstName: "Prénom",
      lastName: "Nom",
      studentCode: "Code élève",
      currentClass: "Classe actuelle",
      guardian: "Responsable",
      guardians: "Responsables",
      health: "Santé",
      attendanceHistory: "Historique des présences",
      financeSummary: "Résumé financier",
      reportCard: "Bulletin",
      active: "Actif",
      registered: "Inscrit",
      suspended: "Suspendu",
      withdrawn: "Retiré",
      transferred: "Transféré",
      graduated: "Diplômé",
      archived: "Archivé",
    },

    attendance: {
      title: "Présences",
      description: "Prenez les présences par classe, date et session.",
      date: "Date",
      slot: "Session",
      morning: "Matin",
      afternoon: "Après-midi",
      present: "Présent",
      absent: "Absent",
      late: "En retard",
      excused: "Excusé",
      submitAttendance: "Soumettre les présences",
      attendanceSubmitted: "Présences soumises avec succès.",
      roster: "Liste des élèves",
    },

    gradebooks: {
      title: "Cahier de notes",
      description:
        "Créez des évaluations, saisissez les notes et préparez les bulletins.",
      selectClass: "Sélectionner une classe",
      selectSubject: "Sélectionner une matière",
      createAssessment: "Créer une évaluation",
      assessmentTitle: "Titre de l'évaluation",
      assessmentType: "Type d'évaluation",
      maxPoints: "Points maximum",
      weight: "Pondération",
      score: "Note",
      saveScores: "Enregistrer les notes",
      scoresSaved: "Notes enregistrées avec succès.",
      reportCard: "Bulletin",
      average: "Moyenne",
      coefficient: "Coefficient",
      weightedAverage: "Moyenne pondérée",
    },

    finance: {
      title: "Finances",
      description: "Gérez les factures, paiements, reçus et paie du personnel.",
      invoices: "Factures",
      invoice: "Facture",
      payments: "Paiements",
      payment: "Paiement",
      receipts: "Reçus",
      createInvoice: "Créer une facture",
      recordPayment: "Enregistrer un paiement",
      amount: "Montant",
      balance: "Solde",
      balanceDue: "Solde à payer",
      paid: "Payé",
      partiallyPaid: "Partiellement payé",
      unpaid: "Impayé",
      printInvoice: "Imprimer la facture",
      printReceipt: "Imprimer le reçu",
      thermalPrint: "Impression 80mm",
    },

    payroll: {
      title: "Paie",
      description:
        "Gérez les profils salariaux, traitements de paie et fiches de paie.",
      staffProfile: "Profil du personnel",
      payrollRun: "Traitement de paie",
      payslip: "Fiche de paie",
      salary: "Salaire",
      markPaid: "Marquer comme payé",
      paymentReference: "Référence de paiement",
      printPayslip: "Imprimer la fiche de paie",
    },

    demo: {
      title: "Démo finale",
      description: "Centre de contrôle pour la présentation client.",
      roadmap: "Plan de démonstration client",
      roadmapDescription:
        "Suivez cette séquence pour présenter le workflow complet de gestion scolaire.",
      talkingPoints: "Points clés de présentation",
      emergencyLinks: "Liens rapides de démonstration",
      demoRule: "Règle de démonstration",
    },
  },

  en: {
    common: {
      appName: "ALMAC School Management",
      loading: "Loading...",
      save: "Save",
      saving: "Saving...",
      refresh: "Refresh",
      refreshing: "Refreshing...",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      print: "Print",
      back: "Back",
      search: "Search",
      status: "Status",
      actions: "Actions",
      yes: "Yes",
      no: "No",
      active: "Active",
      inactive: "Inactive",
      required: "Required",
      optional: "Optional",
      select: "Select",
      noRecords: "No records found.",
      createdSuccessfully: "Created successfully.",
      savedSuccessfully: "Saved successfully.",
      openWorkspace: "Open workspace",
      ready: "Ready",
    },

    auth: {
      forgotPassword: {
        title: "Forgot password",
        description: "Enter your email address. If an eligible account exists, you will receive reset instructions.",
        email: "Email address",
        submit: "Send instructions",
        submitting: "Sending...",
        successTitle: "Check your inbox",
        successMessage: "If an eligible account exists for this address, a password-reset email will be sent.",
        backToLogin: "Back to login",
        requestFailed: "Unable to process the request.",
      },
      resetPassword: {
        title: "Create a new password",
        checking: "Checking the link...",
        invalidTitle: "Link unavailable",
        invalidMessage: "This password-reset link is invalid or has expired.",
        account: "Account",
        password: "New password",
        confirmPassword: "Confirm password",
        passwordHint: "Use at least 15 characters. Spaces are allowed.",
        submit: "Reset password",
        submitting: "Resetting...",
        mismatch: "The passwords do not match.",
      },
    },
    nav: {
      dashboard: "Dashboard",
      demo: "Final Demo",
      academicStructure: "Academic Structure",
      academics: "Academics",
      admissions: "Admissions",
      students: "Students",
      users: "Users",
      attendance: "Attendance",
      gradebooks: "Gradebook",
      finance: "Finance",
      payroll: "Payroll",
      reports: "Reports",
      settings: "Settings",
      schools: "Schools",
      staff: "Staff",
      onboarding: "Onboarding",
      activity: "Activity",
    },

    workspace: {
      currentRoleContext: "Current Role Context",
      noActiveRole: "No active role",
      quickActions: "Quick Actions",
      quickActionsDescription: "Shortcuts relevant to this workspace.",
      operationalAttention: "Operational Attention",
      operationalAttentionDescription: "Things worth checking before continuing.",
    },

    dashboard: {
      title: "Dashboard",
      description:
        "Overview of school operations, admissions, attendance, finance, and academics.",
      schoolOverview: "School Overview",
      operationalSummary: "Operational summary for today.",
      activeStudents: "Active students",
      registeredStudents: "registered students",
      pendingAdmissions: "Pending admissions",
      admittedApplications: "admitted/confirmed",
      attendanceToday: "Attendance today",
      present: "present",
      absent: "absent",
      unpaidInvoices: "Unpaid invoices",
      due: "due",
      paymentsToday: "Payments today",
      thisMonth: "this month",
      assessments: "Assessments",
      gradebookRecords: "Gradebook records",
      payrollPending: "Payroll pending",
      salaryItemsPending: "salary items pending payment",
      setup: "Setup",
      structureSectionsSubjects: "Structure, sections, and subjects",
      schoolDashboard: "School Dashboard",
      liveOperationalSummary: "Live operational summary for the active school.",
      demoFlows: "Core demo flows",
      demoFlowsDescription:
        "Every major workflow is one click away from this dashboard.",
      studentFiles: "Student files",
      financeReceipts: "Finance & receipts",
      gradebooksReports: "Gradebooks & reports",
      payrollPayslips: "Payroll & payslips",
    },

    academic: {
      title: "Academic Structure",
      description:
        "Configure divisions, classes, sections, subjects, and coefficients.",
      workspaceTitle: "Academic Workspace",
      workspaceDescription:
        "Review and manage the academic structure and pedagogical organization of the school.",
      operationsTitle: "Academic Operations",
      operationsSubtitle:
        "Choose the divisions offered by this school, then add extra sections when needed.",
      academicOperations: "Academic operations",
      academicOperationsDescription:
        "Choose the divisions offered by this school, then add extra sections if needed.",
      quickActionStructureTitle: "Academic Structure",
      quickActionStructureDescription:
        "Choose offered divisions and review grade levels and sections.",
      quickActionAttendanceTitle: "Attendance",
      quickActionAttendanceDescription:
        "Move from class structure into daily attendance operations.",
      quickActionGradebookTitle: "Gradebook",
      quickActionGradebookDescription:
        "Review assessment and scoring workflows by academic context.",
      quickActionSettingsTitle: "Settings",
      quickActionSettingsDescription:
        "Review academic setup and structural readiness.",
      attentionStructureTitle:
        "Academic structure drives the whole school workflow",
      attentionStructureDescription:
        "Each school can choose its own structure: Kindergarten only, Primary only, Secondary only, or a combination.",
      attentionTeacherSubjectTitle:
        "Check teacher-subject assignments",
      attentionTeacherSubjectDescription:
        "A teacher should only see the classes and subjects that belong to their real assignment.",
      attentionTeacherPriorityTitle: "Teacher priority",
      attentionTeacherPriorityDescription:
        "Use this area to confirm your assigned academic context before taking attendance or managing gradebooks.",
      attentionAdminPriorityTitle: "Admin priority",
      attentionAdminPriorityDescription:
        "Validate the structure before publishing grades, generating report cards, or starting a new term.",
      quickSetupTitle: "Quick academic structure setup",
      quickSetupDescription:
        "Select the classes offered by the school and enter the number of sections/classrooms.",
      saveStructure: "Save Structure",
      selectAtLeastOneClass: "Select at least one class.",
      structureSaved:
        "Structure saved: {gradeCount} classes and {sectionCount} sections.",
      kindergarten: "Kindergarten",
      primary: "Primary / Fundamental",
      secondary: "Secondary",
      other: "Other",
      enableAll: "Enable all",
      sections: "Sections",
      noSectionYet: "No section yet.",
      quickSetupNotice:
        "This setup creates or updates classes and sections. It does not delete existing students, invoices, attendance, or grades.",
      classesAndSections: "Classes and sections",
      classesAndSectionsDescription:
        "Easily adjust the number of sections/classrooms for each class.",
      numberOfSections: "Number of sections",
      code: "Code",
      classCount: "{count} class(es)",
      sectionsUpdated: "Sections updated.",
      blockedArchive:
        "Saved, but {count} section(s) could not be archived because they still have active students.",
      gradeLevels: "Grade levels",
      sectionSubjects: "Section subjects",
      teachingAssignments: "Teaching assignments",
      noTeachingAssignments: "No teaching assignments found.",
      noActiveAcademicYear: "No active academic year found. Complete school setup first.",
      teacher: "Teacher",
      order: "Order",
      subjectSetup: "Subject Setup",
      subjectSetupDescription:
        "Create school subjects and assign them to each class with a coefficient.",
      createSubject: "Create Subject",
      subjectCodePlaceholder: "Code, example: MATH",
      frenchName: "French name",
      englishNameOptional: "English name optional",
      descriptionOptional: "Description optional",
      saveSubject: "Save Subject",
      assignSubject: "Assign Subject",
      assigning: "Assigning...",
      assignSubjectToClass: "Assign Subject to Class",
      selectGradeLevel: "Select grade level",
      selectSubject: "Select subject",
      coefficient: "Coefficient",
      displayOrder: "Display order",
      requiredSubject: "Required subject",
      subjectSaved: "Subject saved successfully.",
      subjectAssigned: "Subject assigned successfully.",
      noSubjectsYet: "No subjects created yet.",
      noAssignedSubjects:
        "No subjects assigned to this grade level yet.",
      advancedManualConfiguration: "Advanced manual configuration",
      advancedManualDescription:
        "Use these controls when you need to adjust generated classes, sections, or capacities by hand.",
      configureAcademicDivisions: "Configure academic divisions",
      selectOfferedLevels: "Select only the levels offered by this school.",
      createSelectedStructure: "Create selected structure",
      creating: "Creating...",
      manualGradeLevelsAndSections: "Manual grade levels and sections",
      configureRoomsSections: "Configure rooms / sections",
      noSectionsConfigured: "No sections configured yet.",
    },

    users: {
      management: {
        title: "Users and access", description: "Invite staff members and manage their access to the school.", inviteUser: "Invite a user", inviteDescription: "The user will receive a secure email to activate their account.", email: "Email address", firstName: "First name", lastName: "Last name", role: "Role", language: "Email language", sendInvitation: "Send invitation", sendingInvitation: "Sending invitation...", usersTab: "Users", invitationsTab: "Invitations", verified: "Email verified", notVerified: "Email not verified", lastLogin: "Last login", neverConnected: "Never signed in", membershipActive: "Access active", membershipSuspended: "Access suspended", suspend: "Suspend", reactivate: "Reactivate", resend: "Resend", revoke: "Revoke", pending: "Pending", accepted: "Accepted", expired: "Expired", revoked: "Revoked", emailDeliveryFailed: "Email delivery failed", invitationSent: "The invitation was created and sent.", invitationCreatedButEmailFailed: "The invitation was created, but the email could not be sent.", noUsers: "No users found.", noInvitations: "No invitations found.", confirmSuspend: "Suspend this user’s access to the school?", confirmRevoke: "Revoke this invitation?",
        staffCode: "Staff code",
        jobTitle: "Job title",
        department: "Department",
        guardian: "Parent / guardian record",
        selectGuardian: "Select a guardian",
        alreadyLinked: "Account already linked",
        financePermissions: "Initial finance permissions",
        payrollNotDefault: "Payroll access is not granted by default.",
        permissions: {
          FINANCE_DASHBOARD_VIEW: "View finance dashboard",
          FINANCE_INVOICES_VIEW: "View invoices",
          FINANCE_INVOICES_CREATE: "Create invoices",
          FINANCE_INVOICES_EDIT: "Edit invoices",
          FINANCE_INVOICES_VOID: "Void invoices",
          FINANCE_BILLING_MANAGE: "Manage billing plans and runs",
          FINANCE_PAYMENTS_VIEW: "View payments",
          FINANCE_PAYMENTS_RECORD: "Record payments",
          FINANCE_PAYMENTS_REVERSE: "Reverse payments",
          FINANCE_RECEIPTS_PRINT: "Print receipts",
          FINANCE_REPORTS_VIEW: "View finance reports",
          FINANCE_REPORTS_EXPORT: "Export finance reports",
          FINANCE_SETTINGS_MANAGE: "Manage finance settings",
          FINANCE_CASHIER_SESSIONS_SUPERVISE: "Supervise and reopen cashier sessions",
          FINANCE_CREDIT_NOTES_CREATE: "Create credit notes",
          FINANCE_CORRECTIONS_APPROVE: "Approve finance corrections",
          FINANCE_RECONCILIATION_MANAGE: "Manage deposit reconciliation",
          FINANCE_PERIOD_CLOSE: "Close and reopen financial periods",
          PAYROLL_VIEW: "View payroll",
          PAYROLL_MANAGE: "Manage payroll",
        },        roles: { SCHOOL_ADMIN: "School administrator", TEACHER: "Teacher", FINANCE_ADMIN: "Finance administrator", PARENT: "Parent / Guardian" },
      },
    },
    students: {
      title: "Students",
      description:
        "Manage student files, guardians, classes, status, finance, and attendance.",
      studentFile: "Student file",
      firstName: "First name",
      lastName: "Last name",
      studentCode: "Student code",
      currentClass: "Current class",
      guardian: "Guardian",
      guardians: "Guardians",
      health: "Health",
      attendanceHistory: "Attendance history",
      financeSummary: "Finance summary",
      reportCard: "Report card",
      active: "Active",
      registered: "Registered",
      suspended: "Suspended",
      withdrawn: "Withdrawn",
      transferred: "Transferred",
      graduated: "Graduated",
      archived: "Archived",
    },

    attendance: {
      title: "Attendance",
      description: "Take attendance by class, date, and session.",
      date: "Date",
      slot: "Slot",
      morning: "Morning",
      afternoon: "Afternoon",
      present: "Present",
      absent: "Absent",
      late: "Late",
      excused: "Excused",
      submitAttendance: "Submit attendance",
      attendanceSubmitted: "Attendance submitted successfully.",
      roster: "Roster",
    },

    gradebooks: {
      title: "Gradebook",
      description:
        "Create assessments, enter scores, and prepare report cards.",
      selectClass: "Select class",
      selectSubject: "Select subject",
      createAssessment: "Create assessment",
      assessmentTitle: "Assessment title",
      assessmentType: "Assessment type",
      maxPoints: "Max points",
      weight: "Weight",
      score: "Score",
      saveScores: "Save scores",
      scoresSaved: "Scores saved successfully.",
      reportCard: "Report card",
      average: "Average",
      coefficient: "Coefficient",
      weightedAverage: "Weighted average",
    },

    finance: {
      title: "Finance",
      description: "Manage invoices, payments, receipts, and payroll.",
      invoices: "Invoices",
      invoice: "Invoice",
      payments: "Payments",
      payment: "Payment",
      receipts: "Receipts",
      createInvoice: "Create invoice",
      recordPayment: "Record payment",
      amount: "Amount",
      balance: "Balance",
      balanceDue: "Balance due",
      paid: "Paid",
      partiallyPaid: "Partially paid",
      unpaid: "Unpaid",
      printInvoice: "Print invoice",
      printReceipt: "Print receipt",
      thermalPrint: "80mm print",
    },

    payroll: {
      title: "Payroll",
      description:
        "Manage salary profiles, payroll runs, and payslips.",
      staffProfile: "Staff profile",
      payrollRun: "Payroll run",
      payslip: "Payslip",
      salary: "Salary",
      markPaid: "Mark paid",
      paymentReference: "Payment reference",
      printPayslip: "Print payslip",
    },

    demo: {
      title: "Final Demo",
      description: "Client presentation control center.",
      roadmap: "Client Demo Roadmap",
      roadmapDescription:
        "Follow this sequence to present the full school management workflow.",
      talkingPoints: "Presentation Talking Points",
      emergencyLinks: "Emergency Demo Links",
      demoRule: "Demo Rule",
    },
  },
} as const;

export type Locale = keyof typeof messages;

export const defaultLocale: Locale = "fr";

export const supportedLocales: Locale[] = ["fr", "en"];

export const LOCALE_COOKIE = "almac_locale";

export function isSupportedLocale(
  value: string | undefined | null,
): value is Locale {
  return !!value && supportedLocales.includes(value as Locale);
}

function getByPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
) {
  const value =
    getByPath(messages[locale], key) ??
    getByPath(messages[defaultLocale], key) ??
    key;

  if (typeof value !== "string") {
    return key;
  }

  if (!params) {
    return value;
  }

  return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
    return text.replaceAll(`{${paramKey}}`, String(paramValue));
  }, value);
}
