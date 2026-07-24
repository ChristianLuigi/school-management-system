import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AcademicModule } from './academic/academic.module';
import { AttendanceModule } from './attendance/attendance.module';
import { DbModule } from './db/db.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { GradebooksModule } from './gradebooks/gradebooks.module';
import { GuardiansModule } from './guardians/guardians.module';
import { HealthModule } from './health/health.module';
import { SchoolsModule } from './schools/schools.module';
import { SectionSubjectsModule } from './section-subjects/section-subjects.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AssessmentScoresModule } from './assessment-scores/assessment-scores.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { FeePlansModule } from './fee-plans/fee-plans.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { StudentDiscountsModule } from './student-discounts/student-discounts.module';
import { FinanceAdminModule } from './finance-admin/finance-admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlatformSchoolsModule } from './platform-schools/platform-schools.module';
import { InternalAuthModule } from './internal-auth/internal-auth.module';
import { MeModule } from './me/me.module';
import { SchoolSetupModule } from './school-setup/school-setup.module';
import { PlatformDashboardModule } from './platform-dashboard/platform-dashboard.module';
import { PlatformStaffModule } from './platform-staff/platform-staff.module';
import { PlatformOnboardingModule } from './platform-onboarding/platform-onboarding.module';
import { PlatformActivityModule } from './platform-activity/platform-activity.module';
import { PlatformReportsModule } from './platform-reports/platform-reports.module';
import { SchoolBrandingModule } from './school-branding/school-branding.module';
import { FinanceOperationsModule } from './finance-operations/finance-operations.module';
import { FinancePayrollModule } from './finance-payroll/finance-payroll.module';
import { SchoolStudentsModule } from './school-students/school-students.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { AccessManagementModule } from './access-management/access-management.module';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnvironment,
    }),
    AuthModule,
    AccessManagementModule,
    DbModule,
    HealthModule,
    SchoolsModule,
    AcademicModule,
    TeachersModule,
    GuardiansModule,
    StudentsModule,
    EnrollmentsModule,
    SubjectsModule,
    SectionSubjectsModule,
    AttendanceModule,
    GradebooksModule,
    AssessmentsModule,
    AssessmentScoresModule,
    ReportCardsModule,
    FeePlansModule,
    InvoicesModule,
    PaymentsModule,
    StudentDiscountsModule,
    FinanceAdminModule,
    DashboardModule,
    PlatformSchoolsModule,
    InternalAuthModule,
    MeModule,
    SchoolSetupModule,
    PlatformDashboardModule,
    PlatformStaffModule,
    PlatformOnboardingModule,
    PlatformActivityModule,
    PlatformReportsModule,
    SchoolBrandingModule,
    FinanceOperationsModule,
    FinancePayrollModule,
    SchoolStudentsModule,
    AdmissionsModule,
  ],
})
export class AppModule {}
