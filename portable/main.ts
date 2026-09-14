import { mount } from 'svelte';
import Application from '../src/lib/app/Application.svelte';
import {
  configuration,
  embeddedOrganizationLogo,
  embeddedPartnerOrganizationLogo,
} from './configuration.generated';
import '../src/lib/components/theme.css';

mount(Application, {
  target: document.getElementById('app')!,
  props: { configuration, embeddedOrganizationLogo, embeddedPartnerOrganizationLogo },
});
