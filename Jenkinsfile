// Validation job: never receives registry or deployment credentials.
pipeline {
  agent { label 'cinnai-validation-windows' }
  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    skipStagesAfterUnstable()
    timeout(time: 120, unit: 'MINUTES')
  }
  parameters {
    booleanParam(name: 'LIVE_PLAN', defaultValue: false, description: 'Read-only Azure plan after plan-reader identity and existing backend are configured.')
    choice(name: 'PLAN_STACK', choices: ['foundation','application'], description: 'Existing single environment, never a development deployment.')
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Tests, Docker and Terraform plans') {
      steps {
        lock(resource: 'cinnai-local-docker-validation') {
          powershell '& ./infrastructure/jenkins/validate.ps1'
        }
      }
    }
    stage('Optional read-only Azure plan') {
      when { expression { params.LIVE_PLAN && !env.CHANGE_ID && !env.TAG_NAME && ['main','development','Development'].contains(env.BRANCH_NAME) } }
      steps {
        withCredentials([
          string(credentialsId: 'cinnai-plan-client-id', variable: 'ARM_CLIENT_ID'),
          string(credentialsId: 'cinnai-plan-client-secret', variable: 'ARM_CLIENT_SECRET'),
          string(credentialsId: 'cinnai-plan-tenant-id', variable: 'ARM_TENANT_ID'),
          string(credentialsId: 'cinnai-plan-subscription-id', variable: 'ARM_SUBSCRIPTION_ID'),
          file(credentialsId: "cinnai-plan-${params.PLAN_STACK}-backend", variable: 'TF_BACKEND_FILE'),
          file(credentialsId: "cinnai-plan-${params.PLAN_STACK}-vars", variable: 'TF_VARS_FILE')
        ]) {
          powershell '& ./infrastructure/jenkins/plan-readonly.ps1 -Stack $env:PLAN_STACK'
        }
      }
    }
  }
}
